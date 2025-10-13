// app/api/analytics/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { anonIdFrom } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Белый список имён событий
const ALLOWED = new Set([
  "app_open",
  "photo_uploaded",
  "manual_input_used",
  "recipes_requested",
  "token_spent",
]);

// простая проверка UUID v4
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InEvent = {
  name: string;
  payload?: Record<string, any>;
  sessionId: string;
  ts?: string | number | Date;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const arr: InEvent[] = Array.isArray(body) ? body : [body];

    // 0) анонимный uid (raw) из куки или новый; хэшируем в anonId
    const existing = req.cookies.get("uid")?.value;
    const rawUid = existing ?? crypto.randomUUID();
    const anonId = anonIdFrom(rawUid); // если у тебя async-версия — добавь await

    // 1) Тех.мета
    const ua = req.headers.get("user-agent") ?? null;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      (process.env.NODE_ENV !== "production" ? "127.0.0.1" : null);

    // 2) Валидация/нормализация каждого события
    const rows = [];
    const rejected: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < arr.length; i++) {
      const { name, payload = {}, sessionId, ts } = arr[i] ?? {};

      if (typeof name !== "string" || !ALLOWED.has(name)) {
        rejected.push({ index: i, error: "invalid_event_name" });
        continue;
      }
      if (typeof sessionId !== "string" || !uuidV4.test(sessionId)) {
        rejected.push({ index: i, error: "invalid_session_id" });
        continue;
      }
      if (typeof payload !== "object" || payload === null) {
        rejected.push({ index: i, error: "invalid_payload" });
        continue;
      }

      // время
      const when = ts ? new Date(ts) : new Date();
      if (Number.isNaN(when.getTime())) {
        rejected.push({ index: i, error: "invalid_ts" });
        continue;
      }

      rows.push({
        ts: when.toISOString(),
        anon_user_id: anonId,
        session_id: sessionId,
        name,
        payload,
        ua,
        ip,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, inserted: 0, rejected },
        { status: 400 }
      );
    }

    // 3) Вставка батчем
    const { error } = await supabaseAdmin.from("events").insert(rows);

    if (error) {
  console.error("Supabase insert error:", error);
  const devMsg = process.env.NODE_ENV !== "production" ? error.message : "db_insert_failed";
  return NextResponse.json(
    { ok: false, inserted: 0, rejected, error: devMsg },
    { status: 500 }
  );
}

    // 4) Выставляем httpOnly cookie uid, если не было
    const res = NextResponse.json({
      ok: true,
      inserted: rows.length,
      rejected,
    });

    // secure=true ломает куки на localhost — ставим по окружению
    const isProd = process.env.NODE_ENV === "production";
    if (!existing) {
      res.cookies.set("uid", rawUid, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 60 * 60 * 24 * 180, // 180 дней
        path: "/",
      });
    }
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}

// Preflight (на будущее, если понадобится)
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
