"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { authHeader } from "../../../lib/supabase";

// Client-only mic console (keeps SSR off exactly as in Action 12)
const MicCapture = dynamic(() => import("../MicCapture"), { ssr: false });

/** -----------------------
 * Types and helpers
 * ----------------------*/
type EventItem = {
  id: string;
  title?: string | null;
  start?: string | null;
  end?: string | null;
  created_at?: string | null;
  [k: string]: any;
};

type Diff =
  | { type: "create"; event: EventItem }
  | { type: "update"; event: EventItem }
  | { type: "delete"; id: string }
  | { type: "noop" };

type ListResponse = EventItem[] | { events?: EventItem[] } | Record<string, any>;

function normalizeToArray(data: ListResponse): EventItem[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).events)) return (data as any).events;
  return [];
}

function formatLocal(dt?: string | null) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dt || "";
  }
}

function useToast() {
  const [msg, setMsg] = useState<string>("");
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const show = useCallback((text: string) => {
    setMsg(text);
    setVisible(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setVisible(false), 2200);
  }, []);

  const toast = visible ? (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.85)",
        color: "white",
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 13,
        zIndex: 50,
      }}
      role="status"
      aria-live="polite"
    >
      {msg}
    </div>
  ) : null;

  return { show, toast };
}

/** -----------------------
 * Page component
 * ----------------------*/
export default function EventsDevPage() {
  const { show, toast } = useToast();

  // data
  const [events, setEvents] = useState<EventItem[]>([]);
  const [raw, setRaw] = useState<any>(null);

  // ui state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // quick create form
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");

  /** ---- list ---- */
  const list = useCallback(async () => {
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/calendar/list", {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      setRaw(json);
      if (!res.ok) {
        setEvents([]);
        setError(`list failed ${res.status}`);
        return;
      }
      setEvents(normalizeToArray(json));
    } catch {
      setError("list error");
      setEvents([]);
      setRaw(null);
    }
  }, []);

  /** ---- local datetime input → ISO ---- */
  function localInputToISO(v: string): string | null {
    if (!v) return null;
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }

  /** ---- create (Quick Create form) ---- */
  const handleCreate = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setLoading(true);
      setError(null);
      try {
        const startISO = localInputToISO(startLocal);
        const endISO = localInputToISO(endLocal);
        if (!startISO || !endISO) {
          setError("Please provide valid start and end times.");
          setLoading(false);
          return;
        }
        const headers = await authHeader();
        const res = await fetch("/api/calendar/mutate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "create_event",
            title: title || "(untitled)",
            start: startISO,
            end: endISO,
          }),
        });
        const ok = res.ok;
        await res.text().catch(() => "");
        if (!ok) {
          setError(`create failed ${res.status}`);
          return;
        }
        show("Event created");
        setTitle("");
        setStartLocal("");
        setEndLocal("");
        await list();
      } catch {
        setError("create failed");
      } finally {
        setLoading(false);
      }
    },
    [title, startLocal, endLocal, list]
  );

  /** ---- delete last ---- */
  const handleDeleteLast = useCallback(async () => {
    setError(null);
    if (!events.length) {
      show("No events to delete");
      return;
    }
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/calendar/mutate", {
        method: "POST",
        headers,
        body: JSON.stringify({ op: "delete_last" }),
      });
      const ok = res.ok;
      await res.text().catch(() => "");
      if (!ok) {
        setError(`delete failed ${res.status}`);
        return;
      }
      show("Deleted last event");
      await list();
    } catch {
      setError("delete failed");
    } finally {
      setLoading(false);
    }
  }, [events, list, show]);

  /** ---- undo last ---- */
  const handleUndoLast = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/calendar/mutate", {
        method: "POST",
        headers,
        body: JSON.stringify({ op: "undo_last" }),
      });
      const ok = res.ok;
      await res.text().catch(() => "");
      if (!ok) {
        setError(`undo failed ${res.status}`);
        return;
      }
      show("Undid last change");
      await list();
    } catch {
      setError("undo failed");
    } finally {
      setLoading(false);
    }
  }, [list, show]);

  /** ---- apply diff (Phase 5: live reflection) ---- */
  const applyDiff = useCallback((diff: Diff | undefined | null) => {
    if (!diff) return;
    if (diff.type === "create" && (diff as any).event) {
      setEvents((prev) => [((diff as any).event), ...prev]);
      return;
    }
    if (diff.type === "update" && (diff as any).event) {
      const ev = (diff as any).event as EventItem;
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
      return;
    }
    if (diff.type === "delete" && (diff as any).id) {
      const id = (diff as any).id as string;
      setEvents((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    // noop → nothing
  }, []);

  /** ---- initial load ---- */
  useEffect(() => {
    list();
  }, [list]);

  /** ---- same-tab events (Phase 5) ---- */
  useEffect(() => {
    function onDiff(e: any) {
      const d: Diff | undefined = e?.detail?.diff;
      if (d) applyDiff(d);
    }
    function onRefresh() {
      list();
    }
    window.addEventListener("calendar:diff", onDiff);
    window.addEventListener("calendar:refresh", onRefresh);
    return () => {
      window.removeEventListener("calendar:diff", onDiff);
      window.removeEventListener("calendar:refresh", onRefresh);
    };
  }, [applyDiff, list]);

  /** ---- NEW: cross-tab events (Phase 5.2) ---- */
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("calendar");
      const onMessage = (ev: MessageEvent) => {
        const data = ev.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "diff" && data.diff) {
          applyDiff(data.diff as Diff);
        } else if (data.type === "refresh") {
          list();
        }
      };
      ch.addEventListener("message", onMessage);
      return () => {
        try { ch?.removeEventListener("message", onMessage); ch?.close(); } catch {}
      };
    } catch {
      // ignore
      return;
    }
  }, [applyDiff, list]);

  /** -----------------------
   * Render (Action-12 layout preserved)
   * ----------------------*/
  const hasEvents = events.length > 0;
  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7 };

  return (
    <main style={{ maxWidth: 840, margin: "0 auto", padding: 24 }}>
      {/* Dev header nav */}
      <nav
        aria-label="Dev pages"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "flex-start",
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: "1px dashed #e5e7eb",
        }}
      >
        <a
          href="/ai-test"
          style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          Voice Console (dev)
        </a>
        <span style={{ opacity: 0.4 }}>•</span>
        <a
          href="/ai-test/events"
          style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          aria-current="page"
        >
          Events (dev)
        </a>
      </nav>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Events</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => list()} disabled={loading}>Refresh</button>
          <button onClick={handleDeleteLast} disabled={loading}>Delete last</button>
          <button onClick={handleUndoLast} disabled={loading}>Undo last</button>
        </div>
      </header>

      {/* Quick Create */}
      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>+ New</div>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle}>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Team sync" />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle}>Start</span>
            <input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle}>End</span>
            <input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </label>
          <button type="submit" disabled={loading}>Create</button>
        </form>
        {error && <div style={{ marginTop: 8, color: "#b91c1c" }}>{error}</div>}
      </section>

      {/* Event list */}
      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Events (GET /api/calendar/list)</div>
        {hasEvents ? (
          <ul style={{ display: "grid", gap: 12 }}>
            {events.map((e) => (
              <li key={e.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{e.title || "(untitled)"}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  {e.start ? <span>Start: {formatLocal(e.start)}</span> : null}
                  {e.end ? <span style={{ marginLeft: 12 }}>End: {formatLocal(e.end)}</span> : null}
                </div>
                {e.created_at ? (
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Created: {formatLocal(e.created_at)}</div>
                ) : null}
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>id: {e.id}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.7 }}>(no events)</div>
        )}
      </section>

      {/* Voice Commands on Events page */}
      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Voice Commands</div>
        <MicCapture
          onSuccess={async () => { show("Voice command applied"); await list(); }}
          onCreate={async () => { show("Event created"); await list(); }}
          onDelete={async () => { show("Deleted last event"); await list(); }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Tip: After any voice action, the list refreshes automatically.
        </div>
      </section>

      {/* Raw debug */}
      <details style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Debug payload (/calendar/list)</summary>
        <pre style={{ marginTop: 12, maxHeight: 288, overflow: "auto", fontSize: 12 }}>
{JSON.stringify(raw, null, 2)}
        </pre>
      </details>

      {toast}
    </main>
  );
}
