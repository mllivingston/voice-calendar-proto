// frontend/lib/ai.ts

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  const res = await fetch("/api/ai/asr", { method: "POST", body: form });
  if (!res.ok) throw new Error(`ASR HTTP ${res.status}`);
  const data = await res.json();
  return data?.text ?? "";
}

export async function interpret(text: string, accessToken?: string): Promise<any> {
  const res = await fetch("/api/ai/interpret", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    let msg = `Interpret HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
      if (j?.detail) msg = j.detail;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

// Backend expects the command object DIRECTLY (unwrapped)
export async function mutate(command: any, accessToken?: string): Promise<any> {
  const res = await fetch("/api/calendar/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    let msg = `Mutate HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
      if (j?.detail) msg = j.detail;
    } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

// Action 11: supported by backend store → {"op":"delete_last"}
export async function deleteLastEvent(accessToken?: string): Promise<any> {
  const command = { op: "delete_last" };
  return await mutate(command, accessToken);
}
