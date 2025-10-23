// frontend/components/EventsHeader.tsx
"use client";

import React from "react";

export type EventsHeaderProps = {
  title?: string;
  loading?: boolean;
  onRefresh: () => void;
  onDeleteLast: () => void;
  onUndoLast: () => void;
};

export default function EventsHeader({
  title = "Events",
  loading,
  onRefresh,
  onDeleteLast,
  onUndoLast,
}: EventsHeaderProps) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>{title}</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onRefresh} disabled={!!loading}>Refresh</button>
        <button onClick={onDeleteLast} disabled={!!loading}>Delete last</button>
        <button onClick={onUndoLast} disabled={!!loading}>Undo last</button>
      </div>
    </header>
  );
}
