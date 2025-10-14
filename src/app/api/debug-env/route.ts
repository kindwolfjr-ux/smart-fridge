import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const has = (v?: string) => (typeof v === "string" && v.length > 0);

  return NextResponse.json({
    hasOpenAI: has(process.env.OPENAI_API_KEY),
    hasKvUrl: has(process.env.KV_REST_API_URL),
    hasKvToken: has(process.env.KV_REST_API_TOKEN),
    nodeEnv: process.env.NODE_ENV,
    // 👇 добавили проверки админ-окружения
    hasAdminSecret: has(process.env.ADMIN_SECRET),
    hasAdminUser: has(process.env.ADMIN_USER),
    hasAdminPass: has(process.env.ADMIN_PASS),
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || null,
  });
}
