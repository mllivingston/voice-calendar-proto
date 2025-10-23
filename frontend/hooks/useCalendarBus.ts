// frontend/hooks/useCalendarBus.ts
"use client";

import { useEffect, useRef } from "react";

type UseCalendarBusOpts = {
  onRefresh: () => void;
  onApplyDiff?: (diff: unknown) => void;
  channelNames?: string[];
};

/**
 * Subscribes to BroadcastChannel + window + storage fallbacks.
 * Calls onRefresh() or onApplyDiff(diff) whenever another tab signals a change.
 * Pure side-effect hook: no UI, no state.
 */
export function useCalendarBus({
  onRefresh,
  onApplyDiff,
  channelNames = ["calendar-diff", "calendar"],
}: UseCalendarBusOpts) {
  const refreshRef = useRef(onRefresh);
  const applyRef = useRef(onApplyDiff);

  useEffect(() => {
    refreshRef.current = onRefresh;
    applyRef.current = onApplyDiff;
  }, [onRefresh, onApplyDiff]);

  useEffect(() => {
    const channels: BroadcastChannel[] = [];
    const names = channelNames.length ? channelNames : ["calendar-diff"];

    // Open channels (if supported)
    for (const name of names) {
      try {
        channels.push(new BroadcastChannel(name));
      } catch {
        // ignore if not supported
      }
    }

    const handleBC = (e: MessageEvent) => {
      const data = e?.data ?? {};
      const t = (data && (data.type || data.t)) || "";
      if (t === "calendar_apply_diff" && applyRef.current) {
        applyRef.current(data.diff);
        return;
      }
      // default: refresh
      refreshRef.current?.();
    };

    channels.forEach((ch) => ch.addEventListener("message", handleBC));

    // Fallbacks (window + storage)
    const onWinMessage = (e: MessageEvent) => {
      const data = e?.data ?? {};
      const t = (data && (data.type || data.t)) || "";
      if (t === "calendar_apply_diff" && applyRef.current) {
        applyRef.current(data.diff);
        return;
      }
      if (t === "calendar_diff" || t === "calendar:refresh" || t === "diff" || t === "refresh") {
        refreshRef.current?.();
      }
    };
    window.addEventListener("message", onWinMessage);

    const onStorage = (e: StorageEvent) => {
      if (!e?.key) return;
      if (e.key.startsWith("calendar:refresh")) {
        refreshRef.current?.();
      }
      if (e.key.startsWith("calendar:apply_diff")) {
        try {
          const diff = e.newValue ? JSON.parse(e.newValue) : null;
          applyRef.current?.(diff);
        } catch {
          refreshRef.current?.();
        }
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channels.forEach((ch) => {
        try {
          ch.removeEventListener("message", handleBC);
          ch.close();
        } catch {}
      });
      window.removeEventListener("message", onWinMessage);
      window.removeEventListener("storage", onStorage);
    };
  }, [channelNames.join("::")]);
}

/**
 * Emitters for peer-tab notifications. Safe no-ops if features are unsupported.
 */
export function emitCalendarRefresh(channelNames: string[] = ["calendar-diff"]) {
  try {
    for (const name of channelNames) {
      const ch = new BroadcastChannel(name);
      ch.postMessage({ type: "calendar_diff", ts: Date.now() });
      ch.close();
    }
  } catch {}
  try {
    window.postMessage({ type: "calendar_diff", ts: Date.now() }, "*");
  } catch {}
  try {
    localStorage.setItem(`calendar:refresh:${Math.random()}`, String(Date.now()));
  } catch {}
}

export function emitCalendarApplyDiff(diff: unknown, channelNames: string[] = ["calendar-diff"]) {
  try {
    for (const name of channelNames) {
      const ch = new BroadcastChannel(name);
      ch.postMessage({ type: "calendar_apply_diff", diff, ts: Date.now() });
      ch.close();
    }
  } catch {}
  try {
    window.postMessage({ type: "calendar_apply_diff", diff, ts: Date.now() }, "*");
  } catch {}
  try {
    localStorage.setItem(
      `calendar:apply_diff:${Math.random()}`,
      JSON.stringify(diff ?? null)
    );
  } catch {}
}
