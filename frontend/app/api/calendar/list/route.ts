export async function GET(req: Request) {
  const backend = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000";
  const auth = req.headers.get("authorization") || "";
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;

  const res = await fetch(`${backend}/calendar/list`, {
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
