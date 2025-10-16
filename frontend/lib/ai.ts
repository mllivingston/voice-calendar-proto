type Json = any;

import { authHeader } from "./supabase";

function browserTZ(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

export async function interpret(utterance: string): Promise<Json> {
  const headers = await authHeader();
  const res = await fetch(`/api/ai/interpret`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ text: utterance, tz: browserTZ() }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`interpret failed: ${res.status}`);
  const out = await res.json();
  return out && typeof out === "object" && "command" in out ? out.command : out;
}

export async function mutate(command: any): Promise<Json> {
  const headers = await authHeader();
  const res = await fetch(`/api/calendar/mutate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(command),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`mutate failed: ${res.status}`);
  return res.json();
}
