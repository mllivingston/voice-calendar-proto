export async function POST(req: Request) {
  const backend = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000";
  const auth = req.headers.get("authorization") || "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth) headers["authorization"] = auth;

  const body = await req.text();

  const res = await fetch(`${backend}/calendar/mutate`, {
    method: "POST",
    headers,
    body,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
