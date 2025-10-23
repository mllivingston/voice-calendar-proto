// frontend/hooks/useHistory.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeader } from "../lib/supabase";
import { historyList } from "../clients/calendarClient";

export type HistoryItem = Record<string, any>;

export function useHistory(limit = 5, auto = false) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const headers = await authHeader();
      const { ok, json, status } = await historyList(limit, { headers });
      if (!ok) {
        setItems([]);
        setError(`history failed ${status}`);
        return;
      }
      const data =
        (Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []) as HistoryItem[];
      setItems(data);
    } catch {
      setItems([]);
      setError("history error");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (auto) refresh();
  }, [auto, refresh]);

  return { items, loading, error, refresh };
}
