import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing on server" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") || "";
    let file: File | null = null;

    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const f = form.get("file");
      if (f && f instanceof File) file = f;
    } else {
      const buf = Buffer.from(await req.arrayBuffer());
      const guessedExt =
        contentType.includes("webm") ? "webm" :
        contentType.includes("ogg")  ? "ogg"  :
        contentType.includes("wav")  ? "wav"  :
        contentType.includes("mp3")  ? "mp3"  :
        contentType.includes("m4a")  ? "m4a"  :
        "webm";
      file = new File([buf], `audio.${guessedExt}`, { type: contentType || "audio/webm" });
    }

    if (!file) return NextResponse.json({ error: "No audio file received" }, { status: 400 });

    const openai = new OpenAI({ apiKey });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "json",
    });

    const text = (transcription as any)?.text ?? "";
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Transcription failed" }, { status: 500 });
  }
}
