"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { authHeader } from "../../../lib/supabase";
import { useToast } from "../../../hooks/useToast";
import {
  listEvents,
  postMutate,
  deleteLast,
  undoLast,
  normalizeToArray,
  type EventItem,
} from "../../../clients/calendarClient";
import QuickCreateForm from "../../../components/QuickCreateForm";
import EventList from "../../../components/EventList";
import EventsHeader from "../../../components/EventsHeader";
import { useCalendarBus, emitCalendarRefresh } from "../../../hooks/useCalendarBus";
import { useHistory } from "../../../hooks/useHistory";

const MicCapture = dynamic(() => import("../MicCapture"), { ssr: false });

function localInputToISO(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function EventsDevPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");

  const { toast, show } = useToast();
  const history = useHistory(5, false);

  const formatLocal = useCallback((iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
  }, []);

  const list = useCallback(async () => {
    setError(null);
    try {
      const headers = await authHeader();
      const { ok, json, status } = await listEvents({ headers });
      setRaw(json);
      if (!ok) {
        setEvents([]);
        setError(`list failed ${status}`);
        return;
      }
      setEvents(normalizeToArray(json));
    } catch {
      setEvents([]);
      setError("list error");
      setRaw(null);
    }
  }, []);

  useEffect(() => {
    list();
  }, [list]);

  useCalendarBus({
    onRefresh: list,
    onApplyDiff: () => { list(); },
    channelNames: ["calendar-diff", "calendar"],
  });

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const headers = await authHeader();
        const body = {
          type: "create_event",
          title: title || null,
          start: localInputToISO(startLocal),
          end: localInputToISO(endLocal),
        };
        const { ok, json, status } = await postMutate(body, { headers });
        setRaw(json);
        if (!ok) {
          setError(`create failed ${status}`);
          return;
        }
        show("Created");
        setTitle("");
        setStartLocal("");
        setEndLocal("");
        await list();
        emitCalendarRefresh();
        // history.refresh();
      } catch {
        setError("create failed");
      } finally {
        setLoading(false);
      }
    },
    [title, startLocal, endLocal, list, show]
  );

  const handleDeleteLast = useCallback(
    async () => {
      setError(null);
      setLoading(true);
      try {
        const headers = await authHeader();
        const { ok, json, status } = await deleteLast({ headers });
        setRaw(json);
        if (!ok) {
          setError(`delete failed ${status}`);
          return;
        }
        show("Deleted last");
        await list();
        emitCalendarRefresh();
        // history.refresh();
      } catch {
        setError("delete failed");
      } finally {
        setLoading(false);
      }
    },
    [list, show]
  );

  const handleUndoLast = useCallback(
    async () => {
      setError(null);
      setLoading(true);
      try {
        const headers = await authHeader();
        const { ok, json, status } = await undoLast({ headers });
        setRaw(json);
        if (!ok) {
          setError(`undo failed ${status}`);
          return;
        }
        show("Undid last change");
        await list();
        emitCalendarRefresh();
        // history.refresh();
      } catch {
        setError("undo failed");
      } finally {
        setLoading(false);
      }
    },
    [list, show]
  );

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
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

      <EventsHeader
        title="Events"
        loading={loading}
        onRefresh={list}
        onDeleteLast={handleDeleteLast}
        onUndoLast={handleUndoLast}
      />

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

      <QuickCreateForm
        title={title}
        startLocal={startLocal}
        endLocal={endLocal}
        loading={loading}
        error={error}
        onChange={(next) => {
          if (typeof next.title === "string") setTitle(next.title);
          if (typeof next.startLocal === "string") setStartLocal(next.startLocal);
          if (typeof next.endLocal === "string") setEndLocal(next.endLocal);
        }}
        onSubmit={handleCreate}
      />

      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 6 }}>
          Events (GET /api/calendar/list)
        </div>
        <EventList events={events} formatLocal={formatLocal} />
      </section>

      <details style={{ marginTop: 16 }}>
        <summary className="cursor-pointer text-sm text-gray-600">Raw list response</summary>
        <pre className="text-xs overflow-auto border rounded bg-gray-50 p-2">
{JSON.stringify(raw, null, 2)}
        </pre>
      </details>

      {toast}
    </main>
  );
}
