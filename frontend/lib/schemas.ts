// Minimal runtime guards for backend contracts — no extra deps.

export type EventItem = {
    id: string;
    title?: string | null;
    start?: string | null;
    end?: string | null;
    created_at?: string | null;
    [k: string]: any;
  };
  
  export function isEventItem(x: any): x is EventItem {
    return !!x && typeof x === "object" && typeof x.id === "string";
  }
  
  export function isEventsArray(x: any): x is EventItem[] {
    return Array.isArray(x) && x.every(isEventItem);
  }
  
  export type ListPayload = EventItem[] | { events?: EventItem[] } | Record<string, any>;
  export function isListPayload(x: any): x is ListPayload {
    if (isEventsArray(x)) return true;
    return !!x && typeof x === "object" && isEventsArray((x as any).events ?? []);
  }
  
  export type MutateOk =
    | { status?: "ok"; diff?: any }
    | { events?: EventItem[] } // some implementations return fresh list
    | { result?: any };
  
  export function isMutateOk(x: any): x is MutateOk {
    if (!x || typeof x !== "object") return false;
    if ("status" in x) return (x as any).status === "ok";
    if ("events" in x) return isEventsArray((x as any).events);
    return true; // be permissive; we still guard list fetch after
  }
  