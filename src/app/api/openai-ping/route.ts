// src/app/api/openai-ping/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Ответь одним словом: ПИНГ" }],
      max_tokens: 5,
      temperature: 0,
    });
    return NextResponse.json({ ok: true, reply: r.choices[0].message.content });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; response?: { data?: unknown } };
    console.error("PING_ERROR", err?.status, err?.message, err?.response?.data);
    return NextResponse.json({ ok: false, error: err?.message ?? "unknown error" }, { status: 500 });
  }
}
