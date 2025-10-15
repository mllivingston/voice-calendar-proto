"use client";

import { useState } from "react";

type MutateResp = {
  ok?: boolean;
  op?: string;
  user?: { sub?: string; email?: string };
  diff?: { type?: string; event?: { id?: string; [k: string]: any } };
};

export default function EventsDevPage() {
  const [lastJson, setLastJson] = useState<any>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "noop" | "create" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  async function bearer(): Promise<string> {
    const w = window as any;
    const token: string | undefined =
      (await w?.supabase?.auth?.getSession()?.then((r: any) => r?.data?.session?.access_token)) ||
      w?.devAccessToken;
    if (!token) throw new Error("No access token in browser context");
    return `Bearer ${token}`;
  }

  async function callMutate(body: any) {
    const res = await fetch("/api/calendar/mutate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": await bearer(),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.detail || json?.error || res.statusText);
    setLastJson(json);
    const id = json?.diff?.event?.id ?? json?.event?.id ?? json?.id ?? null;
    if (id) setLastId(id);
    return json as MutateResp;
  }

  const onNoop = async () => {
    setBusy("noop"); setError(null);
    try { await callMutate({ op: "noop", payload: {} }); }
    catch (e: any) { setError(e.message || "noop failed"); }
    finally { setBusy(null); }
  };

  const onCreate = async () => {
    setBusy("create"); setError(null);
    try {
      const now = new Date();
      const in1h = new Date(now.getTime() + 60 * 60 * 1000);
      await callMutate({
        op: "create",
        payload: {
          title: "Sample Event",
          start: now.toISOString(),
          end: in1h.toISOString(),
          data: { source: "ai-test" },
        },
      });
    } catch (e: any) { setError(e.message || "create failed"); }
    finally { setBusy(null); }
  };

  const onDeleteLast = async () => {
    if (!lastId) { setError("No last event id"); return; }
    setBusy("delete"); setError(null);
    try { await callMutate({ op: "delete", payload: { id: lastId } }); }
    catch (e: any) { setError(e.message || "delete failed"); }
    finally { setBusy(null); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">AI Test · Mutate Dev</h1>
      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-2xl border shadow" onClick={onNoop} disabled={!!busy}>
          {busy === "noop" ? "Nooping…" : "Noop"}
        </button>
        <button className="px-4 py-2 rounded-2xl border shadow" onClick={onCreate} disabled={!!busy}>
          {busy === "create" ? "Creating…" : "Create sample"}
        </button>
        <button className="px-4 py-2 rounded-2xl border shadow" onClick={onDeleteLast} disabled={!!busy || !lastId}>
          {busy === "delete" ? "Deleting…" : "Delete last"}
        </button>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      <div className="rounded-2xl border p-3">
        <div className="text-sm text-gray-500">Last event id</div>
        <div className="font-mono text-sm break-all">{lastId || "—"}</div>
      </div>

      <div className="rounded-2xl border p-3">
        <div className="text-sm text-gray-500">Last response</div>
        <pre className="text-xs overflow-auto">{JSON.stringify(lastJson, null, 2)}</pre>
      </div>

      <div className="rounded-2xl border p-3">
        <div className="text-sm text-gray-500">Token source</div>
        <p className="text-sm">
          Uses your Supabase session (supabase.auth.getSession()) or window.devAccessToken if set.
        </p>
      </div>
    </div>
  );
}
