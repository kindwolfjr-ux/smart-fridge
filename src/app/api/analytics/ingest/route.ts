// src/app/api/analytics/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { anonIdFrom } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Белый список событий (snake_case)
const ALLOWED_EVENT_NAMES = [
  "app_open",
  "photo_uploaded",
  "manual_input_used",
  "recipes_requested",
  "token_spent",
] as const;
type AllowedName = (typeof ALLOWED_EVENT_NAMES)[number];

const allowed = new Set<string>(ALLOWED_EVENT_NAMES);

// UUID v4
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeName(n: unknown): string {
  return String(n ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.\-]/g, "_"); // принимаем app.open / app-open → app_open
}

function isAllowedName(n: string): n is AllowedName {
  return allowed.has(n);
}

type EventInput = {
  name: string;
  payload?: Record<string, unknown>;
  ts?: string | number | Date;
  // допускаем и старую форму со sessionId на уровне события
  sessionId?: string;
};

type BodyShape =
  | {
      // новый формат (как шлёт клиентский трекер)
      anon_user_id?: string | null;
      session_id?: string | null;
      ua?: string | null;
      ip?: string | null;
      events: EventInput[];
    }
  // поддержка старого формата (массив событий)
  | EventInput[]
  // поддержка одиночного события
  | EventInput;

export async function POST(req: NextRequest) {
  try {
    const json = (await req.json().catch(() => ({}))) as BodyShape;

    // ── 0) Соберём тех.мета и идентификаторы ──────────────────────────
    const cookieUid = req.cookies.get("uid")?.value;
    const rawUid = cookieUid ?? crypto.randomUUID();

    // Если клиент прислал уже готовый анонимный ID — возьмём его,
    // иначе — захэшируем сырую uid-куку.
    const anon_user_id =
      (typeof (json as any)?.anon_user_id === "string" &&
        (json as any).anon_user_id) ||
      anonIdFrom(rawUid);

    // session_id можно прислать на корне, либо на событии — приоритет у события
    const root_session_id =
      typeof (json as any)?.session_id === "string"
        ? (json as any).session_id
        : null;

    // user-agent / ip
    const uaFromHeader = req.headers.get("user-agent") ?? null;
    const ua =
      (typeof (json as any)?.ua === "string" && (json as any).ua) ||
      uaFromHeader;

    const ipFromHeader =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ip =
      (typeof (json as any)?.ip === "string" && (json as any).ip) ||
      (process.env.NODE_ENV !== "production" ? "127.0.0.1" : ipFromHeader);

    // ── 1) Разворачиваем вход в единый массив событий ─────────────────
    const incoming: EventInput[] = Array.isArray(json)
      ? json
      : Array.isArray((json as any)?.events)
      ? (json as any).events
      : [json as EventInput];

    // ── 2) Валидация/нормализация событий ──────────────────────────────
    const rows: Array<{
      ts: string;
      anon_user_id: string | null;
      session_id: string | null;
      name: AllowedName;
      payload: Record<string, unknown>;
      ua: string | null;
      ip: string | null;
    }> = [];

    const rejected: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < incoming.length; i++) {
      const ev = incoming[i] ?? {};

      // имя события
      const name = normalizeName(ev.name);
      if (!isAllowedName(name)) {
        rejected.push({ index: i, error: "invalid_event_name" });
        continue;
      }

      // payload
      const payload =
        ev.payload && typeof ev.payload === "object" ? ev.payload : {};

      // время
      const when = ev.ts ? new Date(ev.ts) : new Date();
      if (Number.isNaN(when.getTime())) {
        rejected.push({ index: i, error: "invalid_ts" });
        continue;
      }

      // session_id: приоритет у sessionId из события, затем root_session_id
      const s =
        (ev.sessionId && typeof ev.sessionId === "string" && ev.sessionId) ||
        root_session_id ||
        null;

      const session_id = s && uuidV4.test(s) ? s : null;

      rows.push({
        ts: when.toISOString(),
        anon_user_id: anon_user_id ?? null,
        session_id,
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

    // ── 3) Вставка батчем в Supabase ──────────────────────────────────
    const { error } = await supabaseAdmin.from("events").insert(rows);
    if (error) {
      console.error("Supabase insert error:", error);
      const devMsg =
        process.env.NODE_ENV !== "production" ? error.message : "db_insert_failed";
      return NextResponse.json(
        { ok: false, inserted: 0, rejected, error: devMsg },
        { status: 500 }
      );
    }

    // ── 4) Ответ + установка uid-куки, если её не было ────────────────
    const res = NextResponse.json({
      ok: true,
      inserted: rows.length,
      rejected,
    });

    const isProd = process.env.NODE_ENV === "production";
    if (!cookieUid) {
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
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

// Preflight (на будущее)
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
