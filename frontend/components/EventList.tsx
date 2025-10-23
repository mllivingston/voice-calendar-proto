// frontend/components/EventList.tsx
"use client";

import React from "react";
import { type EventItem } from "../clients/calendarClient";

export type EventListProps = {
  events: EventItem[];
  formatLocal: (iso?: string | null) => string;
};

export default function EventList({ events, formatLocal }: EventListProps) {
  const hasEvents = events.length > 0;

  if (!hasEvents) {
    return <div style={{ fontSize: 14, opacity: 0.7 }}>(no events)</div>;
  }

  return (
    <div style={{ maxHeight: 420, overflow: "auto" }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {events.map((e) => (
          <li key={e.id} style={{ padding: 16, borderTop: "1px solid #eee" }}>
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
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {e.start ? <span>Start: {formatLocal(e.start)}</span> : null}
              {e.end ? <span style={{ marginLeft: 12 }}>End: {formatLocal(e.end)}</span> : null}
            </div>
            {e.created_at ? (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Created: {formatLocal(e.created_at)}
              </div>
            ) : null}
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>id: {e.id}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
