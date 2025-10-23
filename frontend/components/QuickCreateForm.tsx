// frontend/components/QuickCreateForm.tsx
"use client";

import React from "react";

export type QuickCreateFormProps = {
  title: string;
  startLocal: string;
  endLocal: string;
  loading?: boolean;
  error?: string | null;
  onChange: (next: Partial<{ title: string; startLocal: string; endLocal: string }>) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export default function QuickCreateForm(props: QuickCreateFormProps) {
  const { title, startLocal, endLocal, loading, error, onChange, onSubmit } = props;

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Quick Create</div>

      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}
      >
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          style={{
            gridColumn: "1 / -1",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
          }}
        />

        <label style={{ gridColumn: "1 / -1", fontSize: 12, opacity: 0.7 }}>
          Times are in your local timezone
        </label>

        <input
          type="datetime-local"
          value={startLocal}
          onChange={(e) => onChange({ startLocal: e.target.value })}
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
        />
        <input
          type="datetime-local"
          value={endLocal}
          onChange={(e) => onChange({ endLocal: e.target.value })}
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
        />

        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button type="submit" disabled={!!loading}>
            {loading ? "Creating…" : "Create Event"}
          </button>
        </div>

        {error && (
          <div
            style={{
              gridColumn: "1 / -1",
              color: "#991b1b",
              background: "#fff1f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 8,
              fontSize: 14,
            }}
          >
            Error: {error}
          </div>
        )}
      </form>
    </section>
  );
}
