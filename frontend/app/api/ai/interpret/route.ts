export const runtime = "nodejs";
import { cookies } from "next/headers";

/**
 * Minimal helper: read Supabase access token from cookie if present.
 * Works even if auth is disabled; returns null when absent.
 */
function getSupabaseAccessTokenFromCookies(): string | null {
  const cookieStore = cookies();
  const all = cookieStore.getAll();
  // Supabase cookie usually: sb-<project-ref>-auth-token
  const authCookie = all.find(c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
  if (!authCookie?.value) return null;

  try {
    const decoded = decodeURIComponent(authCookie.value);
    const parsed = JSON.parse(decoded); // contains currentSession.access_token
    const token = parsed?.currentSession?.access_token || parsed?.access_token;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const url = `${process.env.NEXT_PUBLIC_SERVER_URL}/ai/interpret`;

  // Only add Authorization if we actually find a token.
  const token = getSupabaseAccessTokenFromCookies();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });
}
