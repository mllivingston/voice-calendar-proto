import { NextResponse } from "next/server";

export async function GET() {
  const upstream = process.env.NEXT_PUBLIC_SERVER_URL || null;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : null;

  return NextResponse.json({
    NEXT_PUBLIC_SERVER_URL: upstream,
    NEXT_PUBLIC_SUPABASE_URL: supaUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    note: "Next.js only loads env files from the app root (frontend/). If these are null, your env file is in the wrong place."
  });
}
