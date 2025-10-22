"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { interpret, mutate } from "../../lib/ai";
import ConfirmCommandSheet from "./ConfirmCommandSheet";

/**
 * Derive a readable title from the utterance if the interpreter
 * returned a generic placeholder (AI event, event, meeting, etc.).
 */
function cleanTitle(utterance: string, original?: string | null) {
  const base = (original || "").trim().toLowerCase();
  const generic = new Set(["ai event", "event", "meeting", "appointment", "untitled"]);
  if (!utterance.trim()) return original || "(untitled)";
  if (!original || generic.has(base)) {
    let t = utterance.trim();
    // remove leading "create", "make", "schedule" and trailing prepositions
    t = t.replace(/^(create|make|schedule)\s+/i, "");
    t = t.replace(/\b(at|for|on)\s*$/i, "");
    if (t.length > 60) t = t.slice(0, 57) + "…";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return original!;
}

type Phase = "idle" | "listening" | "interpreting" | "confirming" | "applying" | "done" | "error";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function MicCapture({ onSuccess }: { onSuccess?: () => void }) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Idle");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [command, setCommand] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SR = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  }, []);
  const recRef = useRef<any>(null);

  /** Start / stop mic recording exactly as before (no changes) */
  const handleStart = useCallback(() => {
    if (!SR) {
      setSupported(false);
      setError("SpeechRecognition API not supported in this browser.");
      return;
    }
    setError(null);
    const r = new SR();
    recRef.current = r;
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setTranscript(t);
      setRecording(false);
    };
    r.onerror = (e: any) => {
      setError(e?.error || "Speech error");
      setRecording(false);
    };
    r.onend = () => setRecording(false);
    r.start();
    setRecording(true);
    setStatus("Listening…");
  }, [SR]);

  /** Interpret → confirm */
  const interpretThenConfirm = useCallback(async () => {
    if (!transcript.trim() || busy) return;
    setBusy(true);
    setError(null);
    setPhase("interpreting");
    setStatus("Interpreting…");
    try {
      const out: any = await interpret(transcript);
      const cmd = (out && (out.command ?? out)) || null;
      if (!cmd || typeof cmd !== "object") {
        setPhase("error");
        setStatus("Failed");
        setError("Interpreter returned an empty command.");
        return;
      }

      // Normalize
      const c: any = { ...cmd };
      if (!c.op && c.type) c.op = c.type;
      c.title = cleanTitle(transcript, c.title);

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

  /** Confirm → mutate */
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

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Voice Input</div>
      <div className="flex gap-2">
        <button
          onClick={handleStart}
          className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
          disabled={recording || busy}
        >
          {recording ? "Listening…" : "Start"}
        </button>
        <input
          className="flex-1 rounded-2xl border px-3 py-2 text-sm"
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
        <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>
      )}

      <ConfirmCommandSheet
        open={phase === "confirming" && !!command}
        command={command}
        onCancel={() => {
          setPhase("idle");
          setStatus("Idle");
          setCommand(null);
        }}
        onConfirm={applyMutation}
        busy={busy}
      />

      <p className="text-xs opacity-70">Phase: {phase}</p>
    </div>
  );
}
