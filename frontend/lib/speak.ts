"use client";

let synth: SpeechSynthesis | null = null;

export function speak(text: string) {
  try {
    if (typeof window === "undefined") return;
    synth = synth || window.speechSynthesis || null;
    if (!synth) return;
    // Soft barge-in: cancel any ongoing speech before starting mic or new TTS
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    synth.speak(u);
  } catch {
    /* no-op */
  }
}

export function cancelSpeech() {
  try {
    if (typeof window === "undefined") return;
    const s = window.speechSynthesis;
    if (s && (s.speaking || s.pending)) s.cancel();
  } catch {
    /* no-op */
  }
}
