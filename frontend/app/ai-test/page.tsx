"use client";

import React from "react";
import { interpret, mutate } from "../../lib/ai";

export default function AiTestPage() {
  const [text, setText] = React.useState("create lunch with Owen tomorrow 12 to 12:45");
  const [cmd, setCmd] = React.useState<any>(null);
  const [result, setResult] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
