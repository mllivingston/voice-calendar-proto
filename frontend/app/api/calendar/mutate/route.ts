import { NextRequest, NextResponse } from "next/server";

// Default to localhost:8000 if env is missing to avoid undefined URL crashes.
const upstream = process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8000";

function forwardableHeaders(req: NextRequest) {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  h.set("content-type", "application/json");
  return h;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text(); // preserve exact JSON
    const res = await fetch(`${upstream}/calendar/mutate`, {
      method: "POST",
      headers: forwardableHeaders(req),
      body,
    });

    // passthrough minimal headers to keep types/content intact
    const headers = new Headers();
    const ct = res.headers.get("content-type");
    if (ct) headers.set("content-type", ct);

    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers });
  } catch (e: any) {
    // Never bubble an exception—return a clean JSON error for troubleshooting
    const detail =
      typeof e?.message === "string" ? e.message : (e?.toString?.() ?? "proxy error");
    // Optional: surface to server logs for local dev
    console.error("[api/calendar/mutate] proxy failure:", detail, "upstream:", upstream);
    return NextResponse.json(
      { error: "upstream_connect_failed", detail, upstream },
      { status: 502 }
    );
  }
}

// (Optional clarity): explicit GET -> 405 so accidental GETs don't look like 500s
export async function GET() {
  return NextResponse.json({ error: "method_not_allowed", allow: ["POST"] }, { status: 405 });
}
