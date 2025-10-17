"use client";

import React, { useRef, useState } from "react";

export default function ASRPage() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<"idle" | "recording" | "asr" | "done" | "error">("idle");
  const [transcript, setTranscript] = useState("");
  const [info, setInfo] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopResolveRef = useRef<(() => void) | null>(null);

  async function startRecording() {
    setTranscript("");
    setInfo("");
    setStatus("recording");
    setRecording(true);

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
    ];
    const mimeType = candidates.find(t => (MediaRecorder as any).isTypeSupported?.(t)) || "";

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    chunksRef.current = [];
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data as Blob); };
    mr.onstop = () => { stopResolveRef.current?.(); };

    mr.start();
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current) return;
    setRecording(false);

    const stopped = new Promise<void>(res => { stopResolveRef.current = res; });
    mediaRecorderRef.current.stop();
    await stopped;

    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current = null;

    const type = (chunksRef.current[0] && (chunksRef.current[0] as Blob).type) || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });

    if (!blob.size) {
      setStatus("error");
      setInfo("Captured empty audio. Try again and allow microphone.");
      return;
    }

    try {
      setStatus("asr");
      // multipart upload (Safari-friendly)
      const ext = type.includes("mp4") ? "mp4" :
                  type.includes("m4a") ? "m4a" :
                  type.includes("mpeg")||type.includes("mp3") ? "mp3" :
                  type.includes("ogg") ? "ogg" :
                  type.includes("wav") ? "wav" : "webm";
      const form = new FormData();
      form.append("file", blob, `audio.${ext}`);
      const resp = await fetch("/api/ai/asr", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok || !data?.text) throw new Error(data?.error || `ASR HTTP ${resp.status}`);
      setTranscript(data.text);
      setInfo(`Blob ${type} • ${blob.size} bytes`);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setInfo(e?.message || "Transcription failed");
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">ASR Test</h1>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center gap-3">
          {!recording ? (
            <button onClick={startRecording} className="rounded-2xl px-4 py-2 shadow border">
              🎙️ Start
            </button>
          ) : (
            <button onClick={stopRecording} className="rounded-2xl px-4 py-2 shadow border">
              ⏹️ Stop
            </button>
          )}
          <div className="text-sm opacity-70">Status: {status}</div>
        </div>

        {info && <div className="text-sm opacity-70">{info}</div>}

        <div>
          <div className="text-sm opacity-70 mb-2">Transcript</div>
          <textarea className="w-full rounded-xl border p-2 min-h-[160px]" value={transcript} readOnly />
        </div>
      </div>

      <p className="text-sm opacity-70">
        This page only tests voice ➜ text via <code>/api/ai/asr</code>. No auth required.
      </p>
    </div>
  );
}
