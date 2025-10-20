"use client";

import React from "react";

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

export default function ConfirmCommandSheet({
  open,
  command,
  onConfirm,
  onCancel,
  busy,
}: Props) {
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
      <div className="relative z-50 w-full sm:w-[560px] max-w-full bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Apply this change?</h2>
        </div>

        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          {summarize(command)}
        </p>

        <div className="mt-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 max-h-56 overflow-auto">
          <pre className="text-xs leading-5 whitespace-pre-wrap break-words">
            {JSON.stringify(command ?? {}, null, 2)}
          </pre>
        </div>

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
            type="button"
            onClick={onConfirm}
            disabled={!!busy}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Applying…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
