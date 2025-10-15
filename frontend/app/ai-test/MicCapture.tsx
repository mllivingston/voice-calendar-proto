"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { interpret, mutate } from "../../lib/ai";

type SR = typeof window extends any
  ? (Window & typeof globalThis & { webkitSpeechRecognition?: any; SpeechRecognition?: any })["SpeechRecognition"]
  : any;

export default function MicCapture() {
  const [supported, setSupported] = useState<boolean>(true);
  const [recording, setRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const recognitionRef = useRef<InstanceType<SR> | null>(null);

  const SpeechRecognitionCtor = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }, []);

  useEffect(() => {
    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }
    const r = new SpeechRecognitionCtor();
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
      setTranscript((prev) => {
        const merged = (prev.trim() + " " + (finalText || interimText)).trim();
        return merged.replace(/\s+/g, " ");
      });
    };
    r.onerror = (e: any) => {
      setStatus(`Error: ${e?.error || "unknown"}`);
      setRecording(false);
    };
    r.onend = () => {
      setRecording(false);
      setStatus("Stopped");
    };

    recognitionRef.current = r;
    setSupported(true);

    return () => {
      try {
        r.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionCtor]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript("");
    setStatus("Starting…");
    setRecording(true);
    try {
      recognitionRef.current.start();
    } catch {
      setRecording(false);
      setStatus("Failed to start mic");
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    setStatus("Stopping…");
    try {
      recognitionRef.current.stop();
    } catch {
      setStatus("Failed to stop mic");
    }
  }, []);

  const send = useCallback(async () => {
    if (!transcript.trim() || busy) return;
    setBusy(true);
    setStatus("Interpreting…");
    try {
      // 1) Ask backend/LLM to interpret free text
      const interpretation: any = await interpret(transcript.trim());

      // 2) UNWRAP the command payload for /calendar/mutate
      let command: any = interpretation?.command ?? interpretation;
      if (!command || typeof command !== "object") {
        setStatus("Failed");
        alert("Interpreter returned an empty command.");
        return;
      }

      // 3) Fill sensible defaults for the prototype
      if (!command.type) command.type = "create_event";

      // 4) Polish: if title is missing/untitled, use the transcript (trimmed to 60 chars)
      const t = transcript.trim();
      if ((!command.title || command.title === "untitled") && t) {
        command.title = t.length > 60 ? t.slice(0, 57) + "..." : t;
      }

      setStatus("Mutating…");
      const result: any = await mutate(command);

      setStatus("Done");
      setTranscript("");
      console.log("interpret:", interpretation);
      console.log("mutate result:", result);

      if (result?.ok) {
        alert("Event updated. Check /ai-test/events to confirm.");
      } else {
        alert(`Mutation failed: ${result?.error ?? "unknown error"}`);
      }
    } catch (e: any) {
      setStatus(`Failed: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }, [transcript, busy]);

  if (!supported) {
    return (
      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="text-lg font-semibold">Voice Input</div>
        <p className="mt-1 text-sm">Your browser does not support the Web Speech API. Use manual text input instead.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Voice Input</div>
        <div className="text-xs opacity-70">{status || "Idle"}</div>
      </div>

      <div className="flex gap-2">
        {!recording ? (
          <button
            onClick={start}
            className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
            disabled={busy}
          >
            🎤 Start
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
          >
            ⏹ Stop
          </button>
        )}
        <button
            onClick={send}
            className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
            disabled={!transcript.trim() || busy}
        >
          ➤ Send
        </button>
        <button
          onClick={() => setTranscript("")}
          className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]"
          disabled={busy && recording}
        >
          Clear
        </button>
      </div>

      <textarea
        className="w-full min-h-[120px] rounded-xl border p-3 text-sm leading-5"
        placeholder="Transcript will appear here…"
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />
      <p className="text-xs opacity-70">
        Tip: After sending, open <a className="underline" href="/ai-test/events">/ai-test/events</a> to verify the event.
      </p>
      <div className="text-xs opacity-70">
        View current events at{" "}
        <a className="underline" href="/ai-test/events">
          /ai-test/events
        </a>
        .
      </div>
    </div>
  );
}
