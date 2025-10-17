"use client";

import React, { useEffect, useRef, useState } from "react";
import { transcribeAudio, interpret, mutate, deleteLastEvent } from "../../../lib/ai";

type Diff =
  | { type: "create"; event: any }
  | { type: "update"; event: any }
  | { type: "delete"; id: string }
  | { type: "noop" };

function tryGetSupabaseAccessToken(): string | undefined {
  try {
    const entry = Object.entries(localStorage).find(([k]) => k.endsWith("-auth-token"));
    const raw = entry?.[1] as string | undefined;
    if (!raw) return undefined;
    const obj = JSON.parse(raw);
    return (
      obj?.access_token ||
      obj?.currentSession?.access_token ||
      obj?.data?.session?.access_token ||
      undefined
    );
  } catch {
    return undefined;
  }
}

// Normalize interpret outputs of various shapes into the backend's expected command
function normalizeCommand(cmd: any) {
  if (!cmd || typeof cmd !== "object") return cmd;
  if (cmd.command && typeof cmd.command === "object") return cmd.command; // unwrap { command: {...} }
  if (cmd.cmd && typeof cmd.cmd === "object") return cmd.cmd; // unwrap { cmd: {...} }
  return cmd;
}

async function fetchEvents(accessToken?: string) {
  const res = await fetch("/api/calendar/list", {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `List HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
      if (j?.detail) msg = j.detail;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return (data?.events as any[]) || [];
}

export default function EventsPage() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "recording" | "asr" | "interpret" | "mutate" | "refresh" | "done" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string>("");

  const [transcript, setTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<any>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopResolveRef = useRef<(() => void) | null>(null);

  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    setAccessToken(tryGetSupabaseAccessToken());
  }, []);

  const loadEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const list = await fetchEvents(accessToken);
      setEvents(list);
    } catch (e: any) {
      setEventsError(e?.message || "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const applyDiff = (diff: Diff) => {
    if (!diff) return;
    if (diff.type === "create" && (diff as any).event) {
      const ev = (diff as any).event;
      setEvents((prev) => [ev, ...prev]);
    } else if (diff.type === "update" && (diff as any).event) {
      const ev = (diff as any).event;
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
    } else if (diff.type === "delete" && (diff as any).id) {
      const id = (diff as any).id;
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  };

  async function startRecording() {
    setRecording(true);
    setStatus("recording");
    setError(null);
    setInfo("");
    setTranscript("");
    setLastCommand(null);

    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
    const mimeType =
      (MediaRecorder as any).isTypeSupported?.(candidates[0]) ? candidates[0] :
      (MediaRecorder as any).isTypeSupported?.(candidates[1]) ? candidates[1] :
      (MediaRecorder as any).isTypeSupported?.(candidates[2]) ? candidates[2] :
      (MediaRecorder as any).isTypeSupported?.(candidates[3]) ? candidates[3] :
      "";

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      stopResolveRef.current?.();
    };

    mr.start();
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current) return;
    setRecording(false);

    const mr = mediaRecorderRef.current;
    const stopped = new Promise<void>((res) => {
      stopResolveRef.current = res;
    });
    mr.stop();
    await stopped;

    try {
      mr.stream.getTracks().forEach((t) => t.stop());
    } catch {}

    mediaRecorderRef.current = null;

    const firstType = (chunksRef.current[0] as any)?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: firstType });

    if (!blob.size) {
      setStatus("error");
      setError("Captured empty audio. Check mic permissions and try again.");
      return;
    }

    try {
      // 1) ASR
      setStatus("asr");
      const text = await transcribeAudio(blob);
      setTranscript(text || "");
      setInfo(`Blob ${blob.type} • ${blob.size} bytes`);

      if (!text) {
        setStatus("done");
        return;
      }

      // 2) Interpret -> normalize
      setStatus("interpret");
      const raw = await interpret(text, accessToken);
      const command = normalizeCommand(raw);
      setLastCommand(command);

      // 3) Mutate with normalized command
      setStatus("mutate");
      const result = await mutate(command, accessToken);

      if (result?.diff) applyDiff(result.diff as Diff);

      // 4) Authoritative refresh
      setStatus("refresh");
      await loadEvents();

      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Voice flow failed");
    }
  }

  async function handleDeleteLast() {
    try {
      setStatus("mutate");
      const result = await deleteLastEvent(accessToken);
      if (result?.deleted || result?.deleted_id) {
        const delId = result.deleted || result.deleted_id;
        if (delId) setEvents(prev => prev.filter(e => e.id !== delId));
      }
      setStatus("refresh");
      await loadEvents();
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Delete failed");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Test — Events</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadEvents()}
            className="rounded-2xl px-3 py-2 shadow border text-sm"
            aria-label="Refresh"
          >
            Refresh
          </button>
          <button
            onClick={handleDeleteLast}
            disabled={events.length === 0}
            className={`rounded-2xl px-3 py-2 shadow border text-sm ${
              events.length > 0 ? "opacity-100" : "opacity-40 cursor-not-allowed"
            }`}
            aria-label="Delete last event"
            title="Delete the most recent event"
          >
            🗑️ Delete last
          </button>
          {!recording ? (
            <button
              onClick={startRecording}
              className="rounded-2xl px-4 py-2 shadow border"
              aria-label="Start voice"
            >
              🎙️ Start
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="rounded-2xl px-4 py-2 shadow border"
              aria-label="Stop voice"
            >
              ⏹️ Stop
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm opacity-70">Events (GET /api/calendar/list)</div>
            </div>

            {eventsLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : eventsError ? (
              <div className="text-sm text-red-600">Error: {eventsError}</div>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="rounded-xl border p-3">
                    <div className="font-medium">{e.title || "(untitled)"}</div>
                    <div className="text-sm opacity-70">
                      {e.start} → {e.end || "—"}
                    </div>
                    <div className="text-[10px] opacity-50 mt-1">id: {e.id}</div>
                  </li>
                ))}
                {events.length === 0 && <li className="text-sm opacity-70">No items yet</li>}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70">Status</div>
            <div className="text-lg">{status}</div>
            {info && <div className="text-sm opacity-70 mt-1">{info}</div>}
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
            {!accessToken && (
              <div className="text-xs opacity-70 mt-2">
                Note: With bypass on, token is not required for local.
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70 mb-2">Transcript</div>
            <textarea
              className="w-full rounded-xl border p-2 min-h-[120px]"
              value={transcript}
              readOnly
            />
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70 mb-2">Last Command (normalized)</div>
            <textarea
              className="w-full rounded-xl border p-2 min-h-[120px]"
              value={lastCommand ? JSON.stringify(lastCommand, null, 2) : ""}
              readOnly
            />
          </div>
        </div>
      </section>
    </div>
  );
}
