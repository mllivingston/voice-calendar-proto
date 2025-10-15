// frontend/lib/ai.ts
"use client";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type InterpretPayload = { prompt: string };
type MutatePayload = { command: unknown };

async function authedFetch(input: RequestInfo, init?: RequestInit) {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

export async function interpret(payload: InterpretPayload) {
  const res = await authedFetch("/api/ai/interpret", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`interpret failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

export async function mutate(payload: MutatePayload) {
  const res = await authedFetch("/api/calendar/mutate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mutate failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}
