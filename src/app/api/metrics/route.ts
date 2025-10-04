// src/app/api/metrics/route.ts
import { NextResponse } from "next/server";

/**
 * Поддержка двух вариантов KV:
 * 1) Vercel KV (Upstash) — переменные: KV_REST_API_URL, KV_REST_API_TOKEN
 * 2) Upstash Redis — переменные: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

/** Мини-обёртка над REST Upstash/Vercel KV */
async function kvFetch(path: string, body: any) {
  if (!KV_URL || !KV_TOKEN) return { ok: false, reason: "KV not configured" };
  const url = KV_URL.replace(/\/$/,"") + path;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Ключи в хранилище */
function keys() {
  const d = new Date();
  const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return {
    stream: `metrics:stream:${day}`, // список последних событий за день
    counters: `metrics:counters:${day}`, // агрегаты за день
  };
}

/** Сохранить метрику в KV (или в консоль, если KV нет) */
async function persistMetric(evt: Record<string, any>) {
  const k = keys();

  // 1) Пишем событие в список (LPUSH + TRIM до 1000)
  // Upstash REST: /lpush, /ltrim, /incrby, /hincrby и т.д.
  // Док: https://docs.upstash.com/redis/rest-api
  // Событие кладём строкой (JSON)
  if (KV_URL && KV_TOKEN) {
    await kvFetch("/lpush", { key: k.stream, value: JSON.stringify(evt) });
    await kvFetch("/ltrim", { key: k.stream, start: 0, stop: 999 });

    // 2) Инкременты по стадии, по cache_key и общие счётчики
    const stage = String(evt.stage || "unknown");
    await kvFetch("/hincrby", { key: k.counters, field: "total", increment: 1 });
    await kvFetch("/hincrby", { key: k.counters, field: `stage:${stage}`, increment: 1 });

    if (evt.cache_key) {
      await kvFetch("/hincrby", { key: k.counters, field: `cache_key:${evt.cache_key}`, increment: 1 });
    }
  } else {
    // Фоллбэк: просто логируем (на деве этого достаточно)
    console.log("[metrics:fallback]", evt);
  }
}

/** GET — получить последние метрики (для отладки в деве) */
export async function GET(req: Request) {
  if (!KV_URL || !KV_TOKEN) {
    return NextResponse.json(
      { ok: false, reason: "KV not configured. Only POST logs to console." },
      { status: 200 }
    );
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 500);
  const k = keys();

  // LRANGE stream 0 limit-1
  const res = await fetch(KV_URL.replace(/\/$/,"") + "/lrange", {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key: k.stream, start: 0, stop: limit - 1 }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data?.result) ? data.result : [];
  const events = list
    .map((s: string) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean);

  return NextResponse.json({ ok: true, events, count: events.length });
}

/** POST — приём метрик */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Нормализуем событие
    const now = new Date();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || undefined;
    const ua = req.headers.get("user-agent") || undefined;

    const event = {
      ts: now.toISOString(),
      stage: body.stage ?? "unknown",
      count_total: Number(body.count_total ?? 0),
      count_selected: Number(body.count_selected ?? 0),
      cache_key: body.cache_key ?? null,
      extra: body.extra ?? null,
      ip, ua,
      // можно добавить user/session id, если появится
    };

    await persistMetric(event);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[metrics] error", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
