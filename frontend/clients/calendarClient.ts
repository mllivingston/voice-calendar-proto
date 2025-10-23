// frontend/clients/calendarClient.ts
export type EventItem = {
    id: string;
    title?: string | null;
    start?: string | null;
    end?: string | null;
    created_at?: string | null;
    [k: string]: any;
  };
  
  export type ListPayload = EventItem[] | { events?: EventItem[]; data?: EventItem[] } | Record<string, any> | null | undefined;
  
  export function normalizeToArray(payload: ListPayload): EventItem[] {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray((payload as any).events)) return (payload as any).events;
    if (payload && Array.isArray((payload as any).data)) return (payload as any).data;
    return [];
  }
  
  type FetchOpts = {
    headers?: HeadersInit;
    signal?: AbortSignal;
  };
  
  export async function listEvents(opts: FetchOpts = {}) {
    const res = await fetch("/api/calendar/list", {
      method: "GET",
      headers: opts.headers,
      credentials: "include",
      cache: "no-store",
      signal: opts.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }
  
  export async function historyList(limit = 5, opts: FetchOpts = {}) {
    const res = await fetch(`/api/calendar/history?limit=${encodeURIComponent(String(limit))}`, {
      method: "GET",
      headers: opts.headers,
      credentials: "include",
      cache: "no-store",
      signal: opts.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }
  
  export async function postMutate(body: any, opts: FetchOpts = {}) {
    const res = await fetch("/api/calendar/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      credentials: "include",
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }
  
  export async function deleteLast(opts: FetchOpts = {}) {
    return postMutate({ op: "delete_last" }, opts);
  }
  
  export async function undoLast(opts: FetchOpts = {}) {
    return postMutate({ op: "undo_last" }, opts);
  }
  