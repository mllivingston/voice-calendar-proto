"use client";

import { useEffect, useState } from "react";
import { fetchHistory, HistoryItem, HistoryResponse } from "../history";

export default function HistoryDrawer() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res: HistoryResponse = await fetchHistory(limit);
      if (res.status === "ok") {
        setItems(res.items ?? []);
      } else {
        setItems([]);
        setError(res.error || "Unexpected error");
      }
    } catch (e: any) {
      setItems([]);
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, limit]);

  return (
    <>
      <div className="fixed bottom-4 right-4 flex gap-2 z-40">
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-2 rounded-2xl shadow bg-black text-white text-sm"
        >
          Open History
        </button>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">History</h2>
              <button
                onClick={() => setOpen(false)}
                className="px-2 py-1 rounded-md border text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-3 border-b flex items-center gap-2">
              <label className="text-sm">Limit</label>
              <input
                type="number"
                value={limit}
                min={1}
                max={200}
                onChange={(e) => setLimit(Number(e.target.value || 20))}
                className="border rounded-md px-2 py-1 w-20"
              />
              <button
                onClick={load}
                className="px-2 py-1 rounded-md border text-sm"
              >
                Refresh
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3">
              {loading && <div className="text-sm">Loading…</div>}
              {error && (
                <div className="text-sm text-red-600 break-words">
                  Error: {error}
                </div>
              )}
              {!loading && !error && items.length === 0 && (
                <div className="text-sm text-gray-500">No history.</div>
              )}
              <ul className="space-y-2">
                {items.map((it, idx) => (
                  <li key={`${it.ts}-${idx}`} className="border rounded-lg p-2">
                    <div className="text-xs text-gray-500">{it.ts}</div>
                    <div className="text-sm font-medium">{it.op}</div>
                    {it.event?.title ? (
                      <div className="text-sm truncate">{it.event.title}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  );
}
