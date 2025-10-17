"use client";

import React from "react";
import dynamic from "next/dynamic";

// Client-only mic console
const MicCapture = dynamic(() => import("./MicCapture"), { ssr: false });

export default function VoiceConsolePage() {
  return (
    <main style={{ maxWidth: 768, margin: "0 auto", padding: 24 }}>
      {/* Dev header nav */}
      <nav
        aria-label="Dev pages"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "flex-start",
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: "1px dashed #e5e7eb",
        }}
      >
        <a
          href="/ai-test"
          style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          aria-current="page"
        >
          Voice Console (dev)
        </a>
        <span style={{ opacity: 0.4 }}>•</span>
        <a href="/ai-test/events" style={{ fontSize: 13, textDecoration: "none" }}>
          Events (dev)
        </a>
      </nav>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Voice Console</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Pipeline: Mic → ASR → Interpret → Mutate
        </div>
      </header>

      <section style={{ border: "1px solid #ddd", borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Record a command</div>
        <MicCapture />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Tip: After a successful command, check <a href="/ai-test/events">Events (dev)</a> for the updated list.
        </div>
      </section>
    </main>
  );
}
