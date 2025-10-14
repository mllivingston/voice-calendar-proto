"use client";

import React, { useEffect, useState } from "react";
import { mutate } from "../../../lib/ai"; // app/ai-test/events/page.tsx → ../../../lib/ai

type EventItem = {
  id: string;
  title?: string;
  start?: string;
  end?: string;
  created_at?: string;
};

function normalizeToArray(payload: any): EventItem[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.events)) return payload.events;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export default function EventsTestPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<any>(null);

  async function refreshEvents() {
    setError(null);
    try {
      const res = await fetch("/api/calendar/list", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      setRaw(json);
      if (!res.ok) {
        setEvents([]);
        setLastEventId(null);
        setError(`list failed ${res.status}`);
        return;
      }
      const arr = normalizeToArray(json);
      setEvents(arr);

      let lastId: string | null = null;
      if (arr.length > 0) {
        const withTime = arr.filter(e => !!e.created_at);
        if (withTime.length > 0) {
          withTime.sort((a, b) => (a.created_at! < b.created_at! ? -1 : 1));
          lastId = withTime[withTime.length - 1].id;
        } else {
          lastId = arr[arr.length - 1].id;
        }
      }
      setLastEventId(lastId);
    } catch {
      setError("list error");
      setEvents([]);
      setLastEventId(null);
      setRaw(null);
    }
  }

  async function handleCreateTest() {
    setLoading(true);
    try {
      const now = new Date();
      const start = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
      const end = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

      await mutate({
        action: "create", // lib/ai.ts also normalizes create_event → create
        params: { title: "Test via events page", start, end }
      });

      await refreshEvents();
    } catch (e: any) {
      setError(`create failed`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteLast() {
    if (!lastEventId) {
      alert("No events to delete.");
      return;
    }
    setLoading(true);
    try {
      await mutate({ action: "delete", event_id: lastEventId });
      await refreshEvents();
    } catch {
      setError("delete failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshEvents();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-extrabold">Event List (per-user)</h1>

      {error && (
        <div className="text-red-700 bg-red-100 border border-red-300 rounded p-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={refreshEvents}
          className="bg-gray-700 text-white px-3 py-1 rounded"
        >
          Refresh
        </button>
        <button
          onClick={handleCreateTest}
          disabled={loading}
          className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Test Event"}
        </button>
        <button
          onClick={handleDeleteLast}
          disabled={loading || !lastEventId}
          className="bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          {loading ? "Deleting..." : "Delete Last Event"}
        </button>
      </div>

      <ul className="space-y-1">
        {(events ?? []).map((e) => (
          <li key={e.id} className="text-sm border-b border-gray-200 pb-1">
            {e.title || "(no title)"} — {e.start} → {e.end}
          </li>
        ))}
        {(events ?? []).length === 0 && !error && (
          <li className="text-sm text-gray-500">(no events)</li>
        )}
      </ul>

      <details>
        <summary className="cursor-pointer text-sm text-gray-600">Raw list response</summary>
        <pre className="text-xs overflow-auto border rounded bg-gray-50 p-2">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}
