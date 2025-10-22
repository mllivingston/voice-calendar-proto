"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const VoiceBar = dynamic(() => import("./VoiceBar"), { ssr: false });

function toBool(x: any) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") {
    const s = x.toLowerCase();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off"].includes(s)) return false;
  }
  return Boolean(x);
}

export default function VoiceShellPage() {
  const params = useSearchParams();

  // Build-time flags (no HTTP). Will require a dev server restart if you change .env.local.
  const VOICE = process.env.NEXT_PUBLIC_VOICE_ENABLED ?? process.env.VOICE_ENABLED ?? "false";
  const TTS = process.env.NEXT_PUBLIC_TTS_ENABLED ?? process.env.TTS_ENABLED ?? "false";

  // Manual overrides for fast testing: /ai-test/voice-shell?voice=1&tts=1
  const voiceOverride = params.get("voice");
  const ttsOverride = params.get("tts");

  const voiceOn = toBool(voiceOverride ?? VOICE);
  const ttsOn = toBool(ttsOverride ?? TTS);

  return (
    <main style={{ padding: 24 }}>
      <nav style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <a href="/ai-test/events" style={{ fontWeight: 700, textDecoration: "none" }}>
          Events (dev)
        </a>
        <span style={{ opacity: 0.4 }}>•</span>
        <a href="/ai-test/voice-shell" aria-current="page" style={{ fontWeight: 700, textDecoration: "none" }}>
          Voice Shell (dev)
        </a>
      </nav>

      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Voice Shell</h1>
      <p style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
        Flag-gated voice bar that uses Web Speech API → interpret → mutate → spoken confirmation.
      </p>

      <section style={{ marginTop: 16 }}>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}
        >
{`Flags (build-time):
NEXT_PUBLIC_VOICE_ENABLED: ${String(VOICE)}
NEXT_PUBLIC_TTS_ENABLED:   ${String(TTS)}

Overrides (URL):
voice: ${String(voiceOverride)}
tts:   ${String(ttsOverride)}

Effective:
voiceOn: ${String(voiceOn)}
ttsOn:   ${String(ttsOn)}
`}
        </pre>
      </section>

      {voiceOn ? (
        <VoiceBar />
      ) : (
        <div style={{ marginTop: 16, fontSize: 14 }}>
          <strong>NEXT_PUBLIC_VOICE_ENABLED</strong> (or query <code>?voice=1</code>) is off. Toggle it on to use the Voice Bar.
        </div>
      )}
    </main>
  );
}
