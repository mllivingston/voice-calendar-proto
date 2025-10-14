"use client";

import React from "react";
import { interpret, mutate } from "../../lib/ai";

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = {
  start(): void;
  stop(): void;
  abort(): void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultItem[];
};

type SpeechRecognitionResultItem = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function AiTestPage() {
  const [text, setText] = React.useState("create lunch with Owen tomorrow 12 to 12:45");
  const [cmd, setCmd] = React.useState<any>(null);
  const [result, setResult] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [listening, setListening] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState<boolean | null>(null);
  const [voiceStatus, setVoiceStatus] = React.useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = React.useState("");
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const voicePipelineActive = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setVoiceSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  React.useEffect(() => () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const runVoicePipeline = React.useCallback(
    async (utterance: string) => {
      const trimmed = utterance.trim();
      if (!trimmed) {
        setVoiceStatus("Heard silence.");
        return;
      }

      voicePipelineActive.current = true;
      setBusy(true);
      setError(null);
      setCmd(null);
      setResult(null);
      setVoiceStatus("Interpreting…");

      try {
        const interpreted = await interpret(trimmed);
        setCmd(interpreted);
        setVoiceStatus("Mutating…");
        const mutated = await mutate(interpreted);
        setResult(mutated);
        setVoiceStatus("Voice command complete.");
      } catch (e: any) {
        setError(e?.message ?? "voice pipeline error");
        setVoiceStatus("Voice pipeline failed.");
      } finally {
        voicePipelineActive.current = false;
        setBusy(false);
      }
    },
    [interpret, mutate]
  );

  const handleStopVoice = React.useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setVoiceStatus("Mic stopped.");
  }, []);

  const handleStartVoice = React.useCallback(() => {
    if (busy) return;

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceStatus("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    setVoiceTranscript("");
    setVoiceStatus("Listening…");
    setListening(true);

    let finalTranscript = "";
    let completed = false;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0]?.transcript ?? "";
        if (res.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      const display = (finalTranscript || interim).trim();
      setVoiceTranscript(display);

      if (!completed && finalTranscript.trim()) {
        completed = true;
        recognition.stop();
        const trimmed = finalTranscript.trim();
        setText(trimmed);
        runVoicePipeline(trimmed);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setVoiceStatus(`Mic error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      if (!voicePipelineActive.current) {
        setVoiceStatus((prev) => prev ?? "Mic stopped.");
      }
    };

    recognition.start();
  }, [busy, runVoicePipeline]);

  async function onInterpret() {
    setBusy(true); setError(null); setCmd(null);
    try {
      const c = await interpret(text);
      setCmd(c);
    } catch (e: any) {
      setError(e?.message ?? "interpret error");
    } finally {
      setBusy(false);
    }
  }

  async function onMutate() {
    if (!cmd) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await mutate(cmd);
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? "mutate error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">AI Test</h1>
      <section className="border rounded p-4 space-y-2 bg-gray-50">
        <h2 className="text-lg font-semibold">Voice capture</h2>
        {voiceSupported === false ? (
          <p className="text-sm text-red-700">
            Speech recognition is not available in this browser. Try Chrome on desktop for the prototype.
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleStartVoice}
              disabled={busy || listening}
              className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50"
            >
              {listening ? "Listening…" : "Start voice"}
            </button>
            <button
              onClick={handleStopVoice}
              disabled={!listening}
              className="px-3 py-2 rounded bg-gray-500 text-white disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        )}
        {voiceStatus && (
          <p className="text-sm text-gray-700">{voiceStatus}</p>
        )}
        {voiceTranscript && (
          <p className="text-sm border rounded bg-white px-3 py-2 font-mono whitespace-pre-wrap">
            {voiceTranscript}
          </p>
        )}
      </section>
      <label className="block">
        <div className="text-sm text-gray-600 mb-1">Command</div>
        <input
          className="w-full border rounded px-3 py-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., move my 2pm standup an hour later"
        />
      </label>

      <div className="flex gap-2">
        <button
          onClick={onInterpret}
          disabled={busy}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
        >Interpret</button>

        <button
          onClick={onMutate}
          disabled={busy || !cmd}
          className="px-3 py-2 rounded bg-gray-800 text-white disabled:opacity-50"
        >Mutate (mock)</button>
      </div>

      {error && (
        <div className="p-3 border border-red-300 bg-red-50 rounded text-red-800">
          {error}
        </div>
      )}

      {cmd && (
        <div>
          <div className="font-medium mb-1">LLM Command JSON</div>
          <pre className="text-sm overflow-auto p-3 border rounded bg-gray-50">
            {JSON.stringify(cmd, null, 2)}
          </pre>
        </div>
      )}

      {result && (
        <div>
          <div className="font-medium mb-1">Mutation Result</div>
          <pre className="text-sm overflow-auto p-3 border rounded bg-gray-50">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
