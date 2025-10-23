"use client";

import React, { useEffect, useRef, useState } from "react";
import { interpret, mutate } from "../../../lib/ai";
import { speak, cancelSpeech } from "../../../lib/speak";
import { getAccessToken } from "../../../lib/authToken";

type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

export default function VoiceBar() {
  const [status, setStatus] = useState<Status>("idle");
  const [lastText, setLastText] = useState<string>("");
  const recRef = useRef<SpeechRecognition | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  const supported =
    typeof window !== "undefined" &&
    (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));

  // Init cross-tab channel
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      bcRef.current = new BroadcastChannel("calendar");
    } catch {
      bcRef.current = null;
    }
    return () => {
      try { bcRef.current?.close(); } catch {}
      bcRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!supported) return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r: SpeechRecognition = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = navigator.language || "en-US";

    r.onresult = async (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(" ").trim();
      setLastText(text);
      setStatus("thinking");
      try {
        const token = await getAccessToken();

        // 1) Interpret (STRING)
        const interp = await interpret(text, token);
        const cmd = (interp && (interp as any).command) ? (interp as any).command : interp;

        // 2) Mutate
        const result = await mutate(cmd, token);

        // 3) Notify listeners (same-tab + cross-tab)
        if (result?.diff) {
          // same-tab event (Phase 5)
          window.dispatchEvent(new CustomEvent("calendar:diff", { detail: { diff: result.diff } }));
          // cross-tab (Phase 5.2)
          try { bcRef.current?.postMessage({ type: "diff", diff: result.diff }); } catch {}
        } else {
          window.dispatchEvent(new CustomEvent("calendar:refresh"));
          try { bcRef.current?.postMessage({ type: "refresh" }); } catch {}
        }

        // 4) TTS
        setStatus("speaking");
        speak("Okay. Done.");
        setTimeout(() => setStatus("idle"), 1200);
      } catch {
        setStatus("error");
        speak("Sorry, I couldn't do that.");
        setTimeout(() => setStatus("idle"), 1200);
      }
    };

    r.onerror = () => { setStatus("error"); setTimeout(() => setStatus("idle"), 800); };
    r.onend = () => { if (status === "listening") setStatus("idle"); };

    recRef.current = r;
    return () => { try { r.abort(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const start = () => {
    if (!supported || !recRef.current) return;
    cancelSpeech(); // soft barge-in
    try { setStatus("listening"); recRef.current.start(); } catch { setStatus("error"); setTimeout(() => setStatus("idle"), 800); }
  };

  const stop = () => {
    if (!supported || !recRef.current) return;
    try { recRef.current.stop(); } catch {}
  };

  return (
    <div style={{
      position: "fixed",
      left: 16,
      right: 16,
      bottom: 16,
      border: "1px solid #ddd",
      borderRadius: 16,
      padding: 12,
      background: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      boxShadow: "0 6px 30px rgba(0,0,0,0.06)",
      zIndex: 50
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusDot status={status} />
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {labelForStatus(status, supported)}
          {lastText && status !== "listening" && (
            <span style={{ marginLeft: 8, opacity: 0.6 }}>“{lastText}”</span>
          )}
        </div>
      </div>

      <button
        onMouseDown={start}
        onMouseUp={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        disabled={!supported || status === "thinking"}
        style={{
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid #ccc",
          background: status === "listening" ? "#fef3c7" : "white",
          fontWeight: 700,
          cursor: supported ? "pointer" : "not-allowed"
        }}
        aria-pressed={status === "listening"}
        aria-label="Push to talk"
        title="Push to talk"
      >
        {status === "listening" ? "Release to send" : "Hold to talk"}
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  const color =
    status === "idle" ? "#d1d5db" :
    status === "listening" ? "#ef4444" :
    status === "thinking" ? "#3b82f6" :
    status === "speaking" ? "#10b981" :
    "#f59e0b";
  return (
    <span
      aria-label={`status-${status}`}
      style={{
        width: 10, height: 10, borderRadius: 999,
        display: "inline-block", background: color
      }}
    />
  );
}

function labelForStatus(s: Status, supported: boolean) {
  if (!supported) return "Browser voice not available";
  switch (s) {
    case "idle": return "Press and speak";
    case "listening": return "Listening…";
    case "thinking": return "Thinking…";
    case "speaking": return "Speaking…";
    case "error": return "Something went wrong";
  }
}
