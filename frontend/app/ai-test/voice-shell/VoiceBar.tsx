"use client";

import React, { useEffect, useRef, useState } from "react";
import { interpret, mutate } from "../../../lib/ai";
import { speak, cancelSpeech } from "../../../lib/speak";

type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

export default function VoiceBar() {
  const [status, setStatus] = useState<Status>("idle");
  const [lastText, setLastText] = useState<string>("");
  const recRef = useRef<SpeechRecognition | null>(null);
  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

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
        const interp = await interpret({ text });
        const cmd = (interp?.command ?? interp?.cmd ?? interp) as any;
        const res = await mutate(cmd);
        setStatus("speaking");
        speak("Okay. Done.");
        // leave status as speaking briefly; return to idle later
        setTimeout(() => setStatus("idle"), 1200);
      } catch (err) {
        setStatus("error");
        speak("Sorry, I couldn't do that.");
        setTimeout(() => setStatus("idle"), 1200);
      }
    };
    r.onerror = () => {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 800);
    };
    r.onend = () => {
      if (status === "listening") setStatus("idle");
    };
    recRef.current = r;
    return () => {
      try { r.abort(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const start = () => {
    if (!supported || !recRef.current) return;
    cancelSpeech(); // soft barge-in
    try {
      setStatus("listening");
      recRef.current.start();
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 800);
    }
  };

  const stop = () => {
    if (!supported || !recRef.current) return;
    try { recRef.current.stop(); } catch {}
  };

  // Minimal, unobtrusive bar that won’t affect existing layouts when embedded
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
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {supported ? (status === "idle" ? "Press and speak" :
            status === "listening" ? "Listening…" :
            status === "thinking" ? "Thinking…" :
            status === "speaking" ? "Speaking…" :
            "Error") : "Browser voice not available"}
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
