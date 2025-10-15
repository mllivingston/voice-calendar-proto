"use client";

import React from "react";
import MicCapture from "./MicCapture";

export default function AITestPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">AI Test — Voice Capture</h1>
      <MicCapture />
      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="text-sm">
          View current events at{" "}
          <a className="underline" href="/ai-test/events">
            /ai-test/events
          </a>
          .
        </div>
      </div>
    </main>
  );
}
