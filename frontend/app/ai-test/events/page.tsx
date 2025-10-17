"use client";

import React, { useEffect, useRef, useState } from "react";
import { transcribeAudio, interpret, mutate } from "../../../lib/ai";

type Diff =
  | { type: "create"; event: any }
  | { type: "update"; event: any }
  | { type: "delete"; id: string }
  | { type: "noop" };

function tryGetSupabaseAccessToken(): string | undefined {
  try {
    // Look for sb-*-auth-token in localStorage (Supabase client default)
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

export default function EventsPage() {
  // UI state
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "recording" | "asr" | "interpret" | "mutate" | "done" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string>("");

  // Data from flow
  const [transcript, setTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  // MediaRecorder plumbing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopResolveRef = useRef<(() => void) | null>(null);

  // Token (if logged in). If not present, interpret/mutate will 401 unless backend bypass is enabled.
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    setAccessToken(tryGetSupabaseAccessToken());
  }, []);

  // Very small in-page "list" until Action 10 adds real GET /calendar/list
  const applyDiff = (diff: Diff) => {
    if (!diff) return;
    if (diff.type === "create" && (diff as any).event) {
      setEvents((prev) => [((diff as any).event), ...prev]);
    } else if (diff.type === "update" && (diff as any).event) {
      setEvents((prev) =>
        prev.map((e) => (e.id === (diff as any).event.id ? (diff as any).event : e))
      );
    } else if (diff.type === "delete" && (diff as any).id) {
      setEvents((prev) => prev.filter((e) => e.id !== (diff as any).id));
    }
  };

  async function startRecording() {
    setRecording(true);
    setStatus("recording");
    setError(null);
    setInfo("");
    setTranscript("");
    setLastCommand(null);

    // Pick a MIME the browser supports (Safari likes mp4/m4a)
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
    ];
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

    // stop mic tracks
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

      // If you just want voice→text, we're done here.
      if (!text) {
        setStatus("done");
        return;
      }

      // 2) Interpret (requires token unless backend bypass is on)
      setStatus("interpret");
      const cmd = await interpret(text, accessToken); // might 401 if not logged in
      setLastCommand(cmd);

      // 3) Mutate (requires token unless backend bypass is on)
      setStatus("mutate");
      const result = await mutate(cmd, accessToken);
      if (result?.diff) applyDiff(result.diff as Diff);

      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Voice flow failed");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Test — Events</h1>
        <div className="flex items-center gap-3">
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
        {/* Left: mock list until Action 10 */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70 mb-2">Recent (mock list; Action 10 will fetch real)</div>
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-xl border p-3">
                  <div className="font-medium">{e.title || "(untitled)"}</div>
                  <div className="text-sm opacity-70">
                    {e.start} → {e.end || "—"}
                  </div>
                </li>
              ))}
              {events.length === 0 && <li className="text-sm opacity-70">No items yet</li>}
            </ul>
          </div>
        </div>

        {/* Right: status/transcript/command */}
        <div className="space-y-4">
          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70">Status</div>
            <div className="text-lg">{status}</div>
            {info && <div className="text-sm opacity-70 mt-1">{info}</div>}
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
            {!accessToken && (
              <div className="text-xs opacity-70 mt-2">
                Note: Not logged in. Interpret/Mutate may 401 unless backend bypass is enabled.
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
            <div className="text-sm opacity-70 mb-2">Last Command (from interpret)</div>
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
