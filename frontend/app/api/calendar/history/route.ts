import { NextRequest, NextResponse } from "next/server";

const upstream = process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8000";

function forwardableHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  return h;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") || "5";
  try {
    const res = await fetch(`${upstream}/calendar/history?limit=${encodeURIComponent(limit)}`, {
      method: "GET",
      headers: forwardableHeaders(req),
      cache: "no-store",
    });
    const headers = new Headers();
    const ct = res.headers.get("content-type");
    if (ct) headers.set("content-type", ct);
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers });
  } catch (e: any) {
    const detail = typeof e?.message === "string" ? e.message : (e?.toString?.() ?? "proxy error");
    return NextResponse.json({ error: "upstream_connect_failed", detail, upstream }, { status: 502 });
  }
}
