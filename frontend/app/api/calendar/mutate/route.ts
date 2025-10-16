import { NextRequest, NextResponse } from "next/server";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

export async function POST(req: NextRequest) {
  try {
    const auth =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";
    const body = await req.json();
    const upstream = await fetch(`${SERVER_URL}/calendar/mutate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth,
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ detail: "Upstream unreachable" }, { status: 502 });
  }
}
