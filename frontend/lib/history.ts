export type CalendarEvent = {
    id: string;
    title: string | null;
    start: string; // ISO
    end: string | null;
    meta?: Record<string, unknown>;
  };
  
  export type HistoryItem = {
    ts: string; // ISO timestamp of mutation
    op: "create" | "update" | "delete" | "move" | string;
    event?: CalendarEvent;
    before?: CalendarEvent | null;
    after?: CalendarEvent | null;
  };
  
  // Success and error shapes we will return to callers
  export type HistoryOk = {
    status: "ok";
    user_id?: string;
    limit?: number;
    total?: number;
    items: HistoryItem[];
  };
  
  export type HistoryErr = {
    status: "error";
    error: string;
  };
  
  export type HistoryResponse = HistoryOk | HistoryErr;
  
  // Tolerate both legacy wrapped and unwrapped forms from the server
  // - Wrapped:   { status: "ok", user_id, total, items }
  // - Unwrapped: { user_id, total, items }
  // - Error:     { error: "..."} or { detail: "..." } or HTTP !ok
  function coerceToHistoryResponse(json: any, httpStatus: number): HistoryResponse {
    const extractErr = (): string => {
      if (!json) return `HTTP ${httpStatus}`;
      if (typeof json.error === "string" && json.error) return json.error;
      if (typeof json.detail === "string" && json.detail) return json.detail;
      if (Array.isArray(json.detail) && json.detail.length) {
        // FastAPI can return list of error objects
        const msg = json.detail
          .map((d: any) => (typeof d?.msg === "string" ? d.msg : ""))
          .filter(Boolean)
          .join("; ");
        if (msg) return msg;
      }
      try {
        const s = JSON.stringify(json);
        if (s && s !== "{}") return s;
      } catch {
        // ignore
      }
      return `HTTP ${httpStatus}`;
    };
  
    // Explicit wrapped success
    if (json && json.status === "ok") {
      return {
        status: "ok",
        user_id: json.user_id,
        limit: typeof json.limit === "number" ? json.limit : undefined,
        total: typeof json.total === "number" ? json.total : undefined,
        items: Array.isArray(json.items) ? (json.items as HistoryItem[]) : [],
      };
    }
  
    // Unwrapped success (no status field but has items array)
    if (json && json.status === undefined && Array.isArray(json.items)) {
      return {
        status: "ok",
        user_id: json.user_id,
        limit: typeof json.limit === "number" ? json.limit : undefined,
        total: typeof json.total === "number" ? json.total : undefined,
        items: json.items as HistoryItem[],
      };
    }
  
    // Anything else is an error (including HTTP !ok)
    return { status: "error", error: extractErr() };
  }
  
  export async function fetchHistory(limit = 20): Promise<HistoryResponse> {
    try {
      const url = `/api/calendar/history?limit=${encodeURIComponent(String(limit))}`;
      const r = await fetch(url, { method: "GET", cache: "no-store" });
  
      // Try to parse JSON, even for non-200 errors
      let json: any = null;
      try {
        json = await r.json();
      } catch {
        // Non-JSON body
      }
  
      return coerceToHistoryResponse(json, r.status);
    } catch (e: any) {
      return { status: "error", error: String(e?.message ?? e) };
    }
  }
  