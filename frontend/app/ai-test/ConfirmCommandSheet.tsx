"use client";

import React, { useEffect, useMemo, useRef } from "react";

type CommandLike = Record<string, any>;

type Props = {
  open: boolean;
  command: CommandLike | null;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

function summarize(cmd: CommandLike | null) {
  if (!cmd) return "—";
  const op = (cmd.op || cmd.type || "").toString().toUpperCase();
  const title = cmd.title ? `“${String(cmd.title)}”` : "";
  const start = cmd.start ? `from ${new Date(cmd.start).toLocaleString()}` : "";
  const end = cmd.end ? `to ${new Date(cmd.end).toLocaleString()}` : "";
  const allDay = cmd.allDay ? "[all-day]" : "";
  return [op, title, start, end, allDay].filter(Boolean).join(" ");
}

function isDestructive(cmd: CommandLike | null) {
  if (!cmd) return false;
  const op = String(cmd.op || cmd.type || "").toLowerCase();
  return op === "delete" || op === "delete_event" || op === "move";
}

function startsInPast(cmd: CommandLike | null) {
  if (!cmd?.start) return false;
  const t = new Date(cmd.start).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function isClearlyIncomplete(cmd: CommandLike | null) {
  if (!cmd) return true;
  const op = String(cmd.op || cmd.type || "").toLowerCase();
  if (!op) return true;
  // For create/update/move, require at least start (your backend tolerates title-null).
  if (op === "create" || op === "update" || op === "move" || op === "create_event") {
    if (!cmd.start) return true;
  }
  return false;
}

export default function ConfirmCommandSheet({
  open,
  command,
  onConfirm,
  onCancel,
  busy,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Derived flags
  const destructive = useMemo(() => isDestructive(command), [command]);
  const past = useMemo(() => startsInPast(command), [command]);
  const incomplete = useMemo(() => isClearlyIncomplete(command), [command]);

  // Autofocus Confirm, Esc/Enter handling
  useEffect(() => {
    if (!open) return;
    // Focus the primary button shortly after mount for accessibility
    const id = window.setTimeout(() => confirmRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onCancel();
      } else if (e.key === "Enter") {
        // Only confirm when not busy and not incomplete
        if (!busy && !incomplete) {
          e.preventDefault();
          onConfirm();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, incomplete, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={busy ? undefined : onCancel}
      />
      {/* Sheet */}
      <div
        className="relative z-50 w-full sm:w-[560px] max-w-full bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="flex items-center justify-between">
          <h2 id="confirm-title" className="text-lg sm:text-xl font-semibold">
            Apply this change?
          </h2>
        </div>

        {/* Risk hints */}
        {(destructive || past) && (
          <div className="mt-3 rounded-xl px-3 py-2 text-sm border"
               style={{
                 borderColor: destructive ? "#fca5a5" : "#fde68a",
                 background: destructive ? "#fee2e2" : "#fef9c3",
                 color: destructive ? "#7f1d1d" : "#78350f",
               }}>
            {destructive && <div><strong>Warning:</strong> This looks destructive.</div>}
            {past && <div>Heads up: the start time appears to be in the past.</div>}
          </div>
        )}

        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          {summarize(command)}
        </p>

        <div className="mt-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 max-h-56 overflow-auto">
          <pre className="text-xs leading-5 whitespace-pre-wrap break-words">
            {JSON.stringify(command ?? {}, null, 2)}
          </pre>
        </div>

        {/* Footer */}
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={!!busy}
            className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={!!busy || incomplete}
            className={`px-3 py-2 rounded-xl text-white disabled:opacity-50 ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            aria-disabled={!!busy || incomplete}
            aria-describedby={incomplete ? "incomplete-hint" : undefined}
          >
            {busy ? "Applying…" : "Confirm"}
          </button>
        </div>
        {incomplete && (
          <p id="incomplete-hint" className="mt-2 text-xs text-neutral-500">
            Confirm is disabled because required fields (e.g., start time) are missing.
          </p>
        )}
      </div>
    </div>
  );
}
