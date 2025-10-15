// Helper for calling backend through Next.js proxy with Supabase auth header

import { createClient } from "@supabase/supabase-js";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

async function authHeader(): Promise<Record<string, string>> {
  try {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// Frontend calls the Next.js API proxies; those proxies forward headers to the FastAPI server.

export async function interpret(text: string) {
  const headers = await authHeader();
  const res = await fetch(`/api/ai/interpret`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`interpret failed: ${res.status}`);
  return res.json();
}

export async function mutate(command: any) {
  const headers = await authHeader();
  const res = await fetch(`/api/calendar/mutate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`mutate failed: ${res.status}`);
  return res.json();
}

export async function listEvents() {
  const headers = await authHeader();
  const res = await fetch(`/api/calendar/list`, {
    method: "GET",
    headers: {
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return res.json();
}
