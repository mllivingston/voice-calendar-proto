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

  // silent history preview data (Action 15)
  const [historySample, setHistorySample] = useState<any[]>([]);

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
        await refreshHistory(); // Action 15 silent check
      } catch {
        setError("create failed");
      } finally {
        setLoading(false);
      }
    },
    [title, startLocal, endLocal, authHeader, list, show]
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
      await refreshHistory(); // Action 15 silent check
    } catch {
      setError("delete failed");
    } finally {
      setLoading(false);
    }
  }, [events, authHeader, list, show]);

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
      await refreshHistory(); // Action 15 silent check
    } catch {
      setError("undo failed");
    } finally {
      setLoading(false);
    }
  }, [authHeader, list, show]);

  /** ---- history fetch (silent) ---- */
  const refreshHistory = useCallback(async (limit = 5) => {
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/calendar/history?limit=${limit}`, {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json && Array.isArray(json.items)) setHistorySample(json.items);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    list();
    refreshHistory();
  }, [list, refreshHistory]);

  const hasEvents = events.length > 0;

  /** -----------------------
   * Render (matches Action-12 layout)
   * ----------------------*/
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
        <a href="/ai-test" style={{ fontSize: 13, textDecoration: "none" }}>
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
          <button onClick={() => list()} disabled={loading}>
            Refresh
          </button>
          <button onClick={handleDeleteLast} disabled={loading}>
            Delete last
          </button>
          <button onClick={handleUndoLast} disabled={loading}>
            Undo last
          </button>
        </div>
      </header>

      {/* Voice Commands on Events page */}
      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Voice Commands</div>
        <MicCapture
          onSuccess={async () => {
            show("Voice command applied");
            await list();
            await refreshHistory();
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Tip: After any voice action, the list refreshes automatically.
        </div>
      </section>

      {/* Quick Create */}
      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Quick Create</div>

        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </div>
          <div>
            <button disabled={loading}>Create event</button>
          </div>
        </form>
      </section>

      {/* Errors */}
      {error && (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 12,
            padding: 12,
            marginTop: 16,
            fontSize: 14,
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Events list */}
      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>Events (GET /api/calendar/list)</div>
        </div>

        {!hasEvents ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No events yet</div>
            <p style={{ fontSize: 14, opacity: 0.7, marginTop: 6 }}>
              Use <span style={{ fontWeight: 600 }}>Quick Create</span> above or go to{" "}
              <a href="/ai-test">/ai-test</a> to add one by voice.
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {events.map((e) => (
                <li key={e.id} style={{ padding: 16, borderTop: "1px solid #eee" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.title || "(untitled)"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>id: {e.id.slice(0, 8)}…</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    {e.start ? <span>Start: {formatLocal(e.start)}</span> : null}
                    {e.end ? <span style={{ marginLeft: 12 }}>End: {formatLocal(e.end)}</span> : null}
                  </div>
                  {e.created_at ? (
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      Created: {formatLocal(e.created_at)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Raw debug payload */}
      <details
        style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}
      >
        <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          Debug payload (/calendar/list)
        </summary>
        <pre
          style={{ marginTop: 12, maxHeight: 288, overflow: "auto", fontSize: 12 }}
        >
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>

      {/* VISUAL-IMPACTING: history panel (Action 15) */}
      {process.env.NEXT_PUBLIC_SHOW_HISTORY === "true" && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 16,
            padding: 16,
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Recent changes (Action 15)
          </div>
          <pre
            style={{
              marginTop: 12,
              maxHeight: 288,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(historySample, null, 2)}
          </pre>
        </section>
      )}

      {toast}
    </main>
  );
}
