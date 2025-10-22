import { NextRequest, NextResponse } from "next/server";

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL;

export async function GET(req: NextRequest) {
  if (!SERVER) {
    return NextResponse.json(
      { status: "error", error: "NEXT_PUBLIC_SERVER_URL is not set" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "20";

  const upstream = `${SERVER.replace(/\/$/, "")}/calendar/history?limit=${encodeURIComponent(
    limit
  )}`;

  try {
    const r = await fetch(upstream, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
