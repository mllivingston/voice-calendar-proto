import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Voice-Calendar Dev Home</h1>
      <ul style={{ marginTop: 12 }}>
        <li><Link href="/ai-test/events">/ai-test/events — Event list & delete last</Link></li>
        <li><Link href="/ai-test">/ai-test — Create/Mutate test</Link></li>
      </ul>
    </main>
  );
}
