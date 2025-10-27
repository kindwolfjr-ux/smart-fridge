// src/app/api/analytics/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Белый список событий (оставим для будущего, но БД не трогаем)
const ALLOWED_EVENT_NAMES = [
  "app_open",
  "photo_uploaded",
  "manual_input_used",
  "recipes_requested",
  "token_spent",
] as const;

function normalizeName(n: unknown): string {
  return String(n ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.\-]/g, "_"); // "app.open" / "app-open" → "app_open"
}

export async function POST(req: NextRequest) {
  try {
    // читаем вход, но никуда не пишем
    const json = await req.json().catch(() => ({} as any));

    // мягкая валидация имен (не обязательна)
    const events = Array.isArray((json as any)?.events)
      ? (json as any).events
      : Array.isArray(json)
      ? json
      : [json];

    const rejected: Array<{ index: number; error: string }> = [];
    events.forEach((ev: any, i: number) => {
      const name = normalizeName(ev?.name);
      if (!ALLOWED_EVENT_NAMES.includes(name as any)) {
        rejected.push({ index: i, error: "invalid_event_name" });
      }
    });

    // ставим uid, если его нет (как раньше)
    const cookieUid = req.cookies.get("uid")?.value;
    const res = NextResponse.json({
      ok: true,
      inserted: 0,                 // ничего не пишем
      rejected,                    // для отладки
      note: "analytics disabled (no Supabase)",
    });

    const isProd = process.env.NODE_ENV === "production";
    if (!cookieUid) {
      res.cookies.set("uid", crypto.randomUUID(), {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 60 * 60 * 24 * 180, // 180 дней
        path: "/",
      });
    }

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

// Preflight
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
