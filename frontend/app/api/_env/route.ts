import { NextResponse } from "next/server";

export async function GET() {
  const upstream = process.env.NEXT_PUBLIC_SERVER_URL || null;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : null;

  const voiceEnabled = process.env.NEXT_PUBLIC_VOICE_ENABLED || "false";
  const ttsEnabled = process.env.NEXT_PUBLIC_TTS_ENABLED || "false";
  const devUi = process.env.NEXT_PUBLIC_DEV_UI || "false";

  return NextResponse.json({
    NEXT_PUBLIC_SERVER_URL: upstream,
    NEXT_PUBLIC_SUPABASE_URL: supaUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    NEXT_PUBLIC_VOICE_ENABLED: voiceEnabled,
    NEXT_PUBLIC_TTS_ENABLED: ttsEnabled,
    NEXT_PUBLIC_DEV_UI: devUi,
    note:
      "Next.js only loads env files from the app root (frontend/). If these are null, your env file is in the wrong place.",
  });
}
