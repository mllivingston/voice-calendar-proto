"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function sendMagicLink() {
    setStatus("Sending magic link…");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + "/ai-test" } });
    if (error) setStatus("Error: " + error.message);
    else setStatus("Check your email for a magic link.");
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Login</h1>
      <input
        className="w-full rounded-xl border p-3 text-sm"
        placeholder="your@email.com"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={sendMagicLink} className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md active:scale-[0.99]">
        Send Magic Link
      </button>
      <div className="text-xs opacity-70">{status}</div>
      <p className="text-xs opacity-70">
        After login, return to <a className="underline" href="/ai-test">/ai-test</a>.
      </p>
    </main>
  );
}
