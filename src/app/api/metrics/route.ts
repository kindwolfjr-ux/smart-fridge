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
async function kvFetch(path: string, body: Record<string, unknown>) {
  if (!KV_URL || !KV_TOKEN) return { ok: false as const, reason: "KV not configured" };
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
  const data: unknown = await res.json().catch(() => ({}));
  return { ok: res.ok as boolean, data };
}

/** Ключи в хранилище */
function keys() {
  const d = new Date();
  const day = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return {
    stream: `metrics:stream:${day}`,
    counters: `metrics:counters:${day}`,
  };
}

/** Сохранить метрику в KV (или в консоль, если KV нет) */
async function persistMetric(evt: Record<string, unknown>) {
  const k = keys();

  if (KV_URL && KV_TOKEN) {
    await kvFetch("/lpush", { key: k.stream, value: JSON.stringify(evt) });
    await kvFetch("/ltrim", { key: k.stream, start: 0, stop: 999 });

    const stage = String((evt as { stage?: unknown }).stage ?? "unknown");
    await kvFetch("/hincrby", { key: k.counters, field: "total", increment: 1 });
    await kvFetch("/hincrby", { key: k.counters, field: `stage:${stage}`, increment: 1 });

    const cacheKey = (evt as { cache_key?: unknown }).cache_key;
    if (cacheKey) {
      await kvFetch("/hincrby", { key: k.counters, field: `cache_key:${cacheKey}`, increment: 1 });
    }
  } else {
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

  const res = await fetch(KV_URL.replace(/\/$/,"") + "/lrange", {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key: k.stream, start: 0, stop: limit - 1 }),
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => ({}));
  const list = Array.isArray((data as { result?: unknown }).result)
    ? ((data as { result: unknown[] }).result)
    : [];

  const events = list
    .map((s) => {
      if (typeof s !== "string") return null;
      try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
    })
    .filter(Boolean) as Record<string, unknown>[];

  return NextResponse.json({ ok: true, events, count: events.length });
}

/** POST — приём метрик */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as unknown;

    const now = new Date();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || undefined;
    const ua = req.headers.get("user-agent") || undefined;

    const obj = (body && typeof body === "object") ? (body as Record<string, unknown>) : {};

    const event = {
      ts: now.toISOString(),
      stage: typeof obj.stage === "string" ? obj.stage : "unknown",
      count_total: Number(obj.count_total ?? 0),
      count_selected: Number(obj.count_selected ?? 0),
      cache_key: typeof obj.cache_key === "string" ? obj.cache_key : null,
      extra: obj.extra ?? null,
      ip,
      ua,
    };

    await persistMetric(event);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[metrics] error", err);
    return NextResponse.json({ ok: false, error: String(err?.message || e) }, { status: 500 });
  }
}
