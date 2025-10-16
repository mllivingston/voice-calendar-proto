import { NextRequest, NextResponse } from "next/server";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

export async function GET(req: NextRequest) {
  try {
    const auth =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";
    const upstream = await fetch(`${SERVER_URL}/calendar/list`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth,
      },
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ detail: "Upstream unreachable" }, { status: 502 });
  }
}
