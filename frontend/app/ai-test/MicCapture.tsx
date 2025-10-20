"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { interpret, mutate } from "../../lib/ai";
import ConfirmCommandSheet from "./ConfirmCommandSheet";

type Props = {
  onSuccess?: () => void; // events page uses this to refresh + toast
};

type Phase = "idle" | "listening" | "interpreting" | "confirming" | "applying" | "done" | "error";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function MicCapture({ onSuccess }: Props) {
  const [supported, setSupported] = useState<boolean>(true);
  const [recording, setRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const [busy, setBusy] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [command, setCommand] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SR = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  }, []);

  const recRef = useRef<any>(null);

  useEffect(() => {
    if (!SR) {
      setSupported(false);
      return;
    }
    const r: any = new SR();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = true;

    r.onstart = () => setStatus("Listening…");
    r.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += chunk + " ";
        else interimText += chunk + " ";
      }
      const merged = (finalText || interimText).trim().replace(/\s+/g, " ");
      if (merged) setTranscript(merged);
    };
    r.onerror = (e: any) => {
      setStatus(`Mic error`);
      setRecording(false);
      setError(e?.message || e?.error || "Microphone error.");
    };
    r.onend = () => {
      setRecording(false);
      setStatus("Stopped");
    };

    recRef.current = r;
    setSupported(true);

    return () => {
      try {
        r.stop();
      } catch {}
      recRef.current = null;
    };
  }, [SR]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    setTranscript("");
    setError(null);
    setPhase("listening");
    setStatus("Starting…");
    setRecording(true);
    try {
      recRef.current.start();
    } catch {
      setRecording(false);
      setStatus("Failed to start mic");
      setPhase("idle");
    }
  }, []);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    setStatus("Stopping…");
    try {
      recRef.current.stop();
    } catch {
      setStatus("Failed to stop mic");
    }
  }, []);

  // 1) Interpret → show confirmation (no mutate yet)
  const interpretThenConfirm = useCallback(async () => {
    const utterance = transcript.trim();
    if (!utterance || busy) return;
    setBusy(true);
    setError(null);
    setPhase("interpreting");
    setStatus("Interpreting…");
    try {
      // IMPORTANT: pass a STRING, not an object, to avoid double-wrapping { text: { text: "…" } }
      const out: any = await interpret(utterance);

      const cmd = (out && (out.command ?? out)) || null;
      if (!cmd || typeof cmd !== "object") {
        setPhase("error");
        setStatus("Failed");
        setError("Interpreter returned an empty command.");
        return;
      }

      // Light normalization for display only
      const c: any = { ...cmd };
      if (!c.op && c.type) c.op = c.type;
      if ((!c.title || c.title === "untitled") && utterance) {
        c.title = utterance.length > 60 ? utterance.slice(0, 57) + "…" : utterance;
      }

      setCommand(c);
      setPhase("confirming");
      setStatus("Review and confirm");
    } catch (e: any) {
      setPhase("error");
      setStatus("Failed");
      setError(e?.message || "Interpret failed");
    } finally {
      setBusy(false);
    }
  }, [transcript, busy]);

  // 2) Confirm → mutate
  const applyMutation = useCallback(async () => {
    if (!command || busy) return;
    setBusy(true);
    setStatus("Applying…");
    setPhase("applying");
    try {
      const result: any = await mutate(command);
      if (!result || result.error) {
        setPhase("error");
        setStatus("Failed");
        setError(result?.error || "Mutation failed");
        return;
      }
      setPhase("done");
      setStatus("Done");
      setTranscript("");
      setCommand(null);
      onSuccess?.();
    } catch (e: any) {
      setPhase("error");
      setStatus("Failed");
      setError(e?.message || "Mutation failed");
    } finally {
      setBusy(false);
    }
  }, [command, busy, onSuccess]);

  if (!supported) {
    return (
      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="text-lg font-semibold">Voice Input</div>
        <p className="mt-1 text-sm">
          Web Speech API not available. Type a request and click Interpret.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Voice Input</div>
        <div className="text-xs opacity-70">{status}</div>
      </div>

      <div className="flex gap-2">
        {!recording ? (
          <button
            onClick={start}
            className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
            disabled={busy}
          >
            Start
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
          >
            Stop
          </button>
        )}
        <input
          className="flex-1 rounded-2xl px-3 py-2 border text-sm"
          placeholder="Say or type a request…"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={busy}
        />
        <button
          onClick={interpretThenConfirm}
          className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
          disabled={!transcript.trim() || busy}
        >
          Interpret
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <ConfirmCommandSheet
        open={phase === "confirming" && !!command}
        command={command}
        onCancel={() => {
          setPhase("idle");
          setStatus("Idle");
        }}
        onConfirm={applyMutation}
        busy={busy}
      />

      <p className="text-xs opacity-70">Phase: {phase}</p>
    </div>
  );
}
