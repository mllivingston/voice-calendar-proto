// frontend/hooks/useToast.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<string>("");
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback((text: string, ms = 1800) => {
    setMsg(text);
    setVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), ms);
  }, []);

  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);

  const toast = (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 16,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease",
        zIndex: 2147483647,
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "saturate(180%) blur(8px)",
          padding: "8px 12px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          fontSize: 14,
        }}
      >
        {msg}
      </div>
    </div>
  );

  return { toast, show };
}
