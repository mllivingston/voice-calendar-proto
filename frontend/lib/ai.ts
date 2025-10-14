type Json = any;

async function postJSON(url: string, body: any): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
}

export async function interpret(utterance: string): Promise<Json> {
  // Try common payload shapes to satisfy whatever the FastAPI/Pydantic schema is.
  const candidates = [
    { input: utterance },
    { text: utterance },
    { query: utterance },
  ];

  // First attempt
  let res = await postJSON("/api/ai/interpret", candidates[0]);
  if (res.ok) return res.json();

  // If validation error (422) or bad request (400), try alternates
  if (res.status === 422 || res.status === 400) {
    for (let i = 1; i < candidates.length; i++) {
      const alt = await postJSON("/api/ai/interpret", candidates[i]);
      if (alt.ok) return alt.json();
    }
  }

  // Fall back to throwing detailed text for debugging
  const text = await res.text().catch(() => "");
  throw new Error(`interpret ${res.status} ${text}`);
}

type MutatePayload = any;

// Map LLM-style actions → backend enum: create | update | delete
function normalizeCommand(cmd: MutatePayload): MutatePayload {
  if (!cmd || typeof cmd !== "object") return cmd;

  const c = { ...cmd };
  const a = (c.action || "").toLowerCase();

  const map: Record<string, string> = {
    create_event: "create",
    update_event: "update",
    delete_event: "delete",
    create: "create",
    update: "update",
    delete: "delete",
  };

  if (map[a]) c.action = map[a];
  return c;
}

export async function mutate(cmd: MutatePayload): Promise<Json> {
  const body = normalizeCommand(cmd);
  const res = await postJSON("/api/calendar/mutate", body);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mutate ${res.status} ${text}`);
  }
  return res.json().catch(() => ({}));
}
