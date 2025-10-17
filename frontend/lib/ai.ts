export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  const res = await fetch("/api/ai/asr", { method: "POST", body: form });
  if (!res.ok) {
    let msg = `ASR HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.text as string;
}

export async function interpret(text: string, accessToken?: string) {
  const res = await fetch("/api/ai/interpret", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ input: text }),
  });
  if (!res.ok) {
    let msg = `Interpret HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function mutate(command: any, accessToken?: string) {
  const res = await fetch("/api/calendar/mutate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    let msg = `Mutate HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
