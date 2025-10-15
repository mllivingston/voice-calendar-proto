import { NextRequest } from "next/server";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const resp = await fetch(`${SERVER_URL}/calendar/list`, {
    method: "GET",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
    },
  });
  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { "Content-Type": resp.headers.get("content-type") || "application/json" },
  });
}
