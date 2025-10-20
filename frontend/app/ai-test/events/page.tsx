"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { safeFetch } from "../../../lib/safeFetch";
import { isListPayload, isMutateOk, ListPayload, EventItem } from "../../../lib/schemas";

// Client-only mic console
const MicCapture = dynamic(() => import("../MicCapture"), { ssr: false });

function normalizeToArray(data: ListPayload): EventItem[] {
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

  const show = useCallback((text: string, ms = 1800) => {
    setMsg(text);
    setVisible(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setVisible(false), ms);
  }, []);

  useEffect(() => () => timeoutRef.current && window.clearTimeout(timeoutRef.current), []);

  const node = (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 16,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        transition: "opacity 200ms ease",
        opacity: visible ? 1 : 0,
        zIndex: 2147483647,
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          background: "rgba(255,255,255,0.95)",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 16,
          padding: "8px 12px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        }}
      >
        <span style={{ fontSize: 14 }}>{msg}</span>
      </div>
    </div>
  );

  return { show, node };
}

function ErrorBanner({ message, detail }: { message: string; detail?: any }) {
  if (!message) return null;
  return (
    <div
      role="status"
      style={{
        border: "1px solid #fecaca",
        background: "#fff1f2",
        color: "#991b1b",
        padding: 12,
        borderRadius: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>Error: {message}</div>
      {detail ? (
        <pre
          style={{
            marginTop: 8,
            fontSize: 12,
            maxHeight: 160,
            overflow: "auto",
            background: "rgba(0,0,0,0.03)",
            padding: 8,
            borderRadius: 8,
          }}
        >
{typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");
  const [errDetail, setErrDetail] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");

  const { show, node: toast } = useToast();

  const authHeader = useCallback(async (): Promise<HeadersInit> => {
    return { "content-type": "application/json" };
  }, []);

  async function list() {
    setErrMsg("");
    setErrDetail(null);
    const headers = await authHeader();
    const res = await safeFetch<ListPayload>(
      "/api/calendar/list",
      { method: "GET", headers, cache: "no-store" },
      isListPayload
    );
    if (!res.ok) {
      setEvents([]);
      setRaw(res.raw ?? null);
      setErrMsg(res.error);
      setErrDetail(res.raw);
      return;
    }
    setRaw(res.data);
    setEvents(normalizeToArray(res.data));
  }

  function localInputToISO(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  const handleCreate = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setLoading(true);
      setErrMsg("");
      setErrDetail(null);
      try {
        const startISO = localInputToISO(startLocal);
        const endISO = localInputToISO(endLocal);
        if (!startISO || !endISO) {
          setErrMsg("Please provide valid start and end times.");
          setLoading(false);
          return;
        }
        const headers = await authHeader();
        const res = await safeFetch(
          "/api/calendar/mutate",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              type: "create_event",
              title: title || "(untitled)",
              start: startISO,
              end: endISO,
            }),
          },
          isMutateOk
        );

        if (!res.ok) {
          setErrMsg(`Create failed: ${res.error}`);
          setErrDetail(res.raw);
          return;
        }
        show("Event created");
        setTitle("");
        setStartLocal("");
        setEndLocal("");
        await list();
      } finally {
        setLoading(false);
      }
    },
    [title, startLocal, endLocal, authHeader]
  );

  const handleDeleteLast = useCallback(async () => {
    setErrMsg("");
    setErrDetail(null);
    if (!events.length) {
      show("No events to delete");
      return;
    }
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await safeFetch(
        "/api/calendar/mutate",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ op: "delete_last" }),
        },
        isMutateOk
      );

      if (!res.ok) {
        setErrMsg(`Delete failed: ${res.error}`);
        setErrDetail(res.raw);
        return;
      }
      show("Deleted last event");
      await list();
    } finally {
      setLoading(false);
    }
  }, [events, authHeader]);

  useEffect(() => {
    list();
  }, []);

  const hasEvents = events.length > 0;
  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.7 };

  return (
    <main style={{ maxWidth: 768, margin: "0 auto", padding: 24 }}>
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
        <a href="/ai-test/events" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }} aria-current="page">
          Events (dev)
        </a>
      </nav>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Events</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => list()} disabled={loading}>Refresh</button>
          <button onClick={handleDeleteLast} disabled={loading}>Delete last</button>
        </div>
      </header>

      {errMsg ? <div style={{ marginTop: 12 }}><ErrorBanner message={errMsg} detail={errDetail} /></div> : null}

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

      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Quick Create</div>
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ gridColumn: "1 / -1", padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
          />
          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Times are in your local timezone</label>
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
          />
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" disabled={loading}>Create event</button>
          </div>
        </form>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 16, marginTop: 16 }}>
        {!hasEvents ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No events yet</div>
            <p style={{ fontSize: 14, opacity: 0.7, marginTop: 6 }}>
              Use <span style={{ fontWeight: 600 }}>Quick Create</span> above or go to <a href="/ai-test">/ai-test</a> to add one by voice.
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {events.map((e) => (
                <li key={e.id} style={{ padding: 16, borderTop: "1px solid #eee" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.title || "(untitled)"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>id: {e.id.slice(0, 8)}…</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    {e.start ? <span>Start: {formatLocal(e.start)}</span> : null}
                    {e.end ? <span style={{ marginLeft: 12 }}>End: {formatLocal(e.end)}</span> : null}
                  </div>
                  {e.created_at ? (
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Created: {formatLocal(e.created_at)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
