type Ok<T> = { ok: true; status: number; data: T };
type Err = { ok: false; status: number; error: string; raw?: any };

export async function safeFetch<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  validate: (x: any) => x is T
): Promise<Ok<T> | Err> {
  try {
    const res = await fetch(input, init);
    const status = res.status;
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      return { ok: false, status, error: `HTTP ${status}`, raw: parsed };
    }
    if (!validate(parsed)) {
      return { ok: false, status, error: "Schema validation failed", raw: parsed };
    }
    return { ok: true, status, data: parsed as T };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message ?? "Network error" };
  }
}
