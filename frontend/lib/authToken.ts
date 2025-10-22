"use client";

/**
 * Returns a Supabase access token if the user is logged in.
 * Works with both @supabase/auth-helpers and vanilla Supabase client storage.
 * Zero dependencies to avoid coupling in Phase 4.
 */
export async function getAccessToken(): Promise<string | undefined> {
  try {
    if (typeof window === "undefined") return undefined;

    // 1) Try official key first (auth-helpers uses this by default)
    const k1 = "supabase.auth.token";
    const v1 = safeParse(localStorage.getItem(k1));
    const t1 =
      v1?.access_token ||
      v1?.currentSession?.access_token ||
      v1?.data?.session?.access_token;
    if (isNonEmptyString(t1)) return t1 as string;

    // 2) Fallback: scan localStorage for anything that smells like a Supabase session
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (!/supabase/i.test(key)) continue;
      const val = safeParse(localStorage.getItem(key));
      const tok =
        val?.access_token ||
        val?.currentSession?.access_token ||
        val?.data?.session?.access_token;
      if (isNonEmptyString(tok)) return tok as string;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function safeParse(raw: string | null) {
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}
