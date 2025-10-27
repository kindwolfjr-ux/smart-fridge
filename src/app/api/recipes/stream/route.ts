// src/app/api/recipes/stream/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
// ❌ убрано: import { supabaseAdmin } from "@/lib/supabase-server";
// ❌ убрано: import { anonIdFrom } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Variant = "basic" | "creative" | "upgrade" | "fast";

function normalizeStock(
  input: unknown
): { names: string[]; stock: { name: string; amount?: number; unit?: string }[] } {
  if (!Array.isArray(input)) return { names: [], stock: [] };

  const stock = (input as any[])
    .map((x) =>
      typeof x === "string"
        ? { name: x.trim().toLowerCase() }
        : {
            name: String(x?.name ?? "").trim().toLowerCase(),
            amount:
              typeof x?.amount === "string" ? Number(String(x.amount).replace(",", ".")) : x?.amount,
            unit: x?.unit ? String(x.unit).trim().toLowerCase() : undefined,
          }
    )
    .filter((x) => x.name);

  const names = Array.from(new Set(stock.map((x) => x.name))).sort();
  return { names, stock };
}

function makePrompts(
  base: string[],
  stock: { name: string; amount?: number; unit?: string }[],
  variant: Variant
) {
  const stockLines = stock
    .map(
      (s) =>
        `- ${s.name}${typeof s.amount === "number" ? `: ${s.amount}` : ""}${s.unit ? ` ${s.unit}` : ""}`
    )
    .join("\n");

  const commonSystem = `
Ты — кулинарный помощник. Пиши ОДИН рецепт из заданных продуктов по шагам.
Если у пользователя есть количества, учитывай их и не превышай явный остаток.
Сразу под названием добавь строку: «⏱ <минуты> • <порции>».
Не добавляй служебный текст. Пиши по-русски.
Формат:
# Название
Короткий лид (2–3 предложения)
Шаг 1 — ...
Шаг 2 — ...
Шаг 3 — ...
`.trim();

  const baseUser = [`Продукты: ${base.join(", ")}.`, stockLines ? "\nС учётом количеств:\n" + stockLines : ""]
    .join("")
    .trim();

  if (variant === "basic") {
    return {
      system:
        commonSystem +
        `
Требование: базовое повседневное блюдо (быстрое, мало действий).
Используй только продукты пользователя + базовые кладовые. Без покупок.`.trim(),
      user: baseUser,
      temperature: 0.4,
    };
  }
  if (variant === "fast") {
    return {
      system:
        commonSystem +
        `
Требование: «на скорую руку» — 7–10 минут TOTAL, минимум действий.
Ингредиентов не более 8; только продукты пользователя + базовые кладовые.`.trim(),
      user: baseUser,
      temperature: 0.3,
    };
  }
  if (variant === "creative") {
    return {
      system:
        commonSystem +
        `
Требование: интересное блюдо (соус/запекание/карамелизация и т.п.), без новых покупок.`.trim(),
      user: baseUser,
      temperature: 0.8,
    };
  }
  // upgrade
  return {
    system:
      commonSystem +
      `
Требование: «апгрейд-версия» — можно докупить до 3 ингредиентов, аккуратно вплести их в рецепт.
В конце добавь строку: Дополнительно: <ингредиент 1>, <ингредиент 2>, <ингредиент 3>`.trim(),
    user: baseUser,
    temperature: 0.7,
  };
}

// NDJSON-стрим: {"delta": "..."} ... {"done":true,"fullText":"..."}
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const body = await req.json().catch(() => ({}));
  const { names, stock } = normalizeStock((body as any).products);

  const variant: Variant = (["basic", "creative", "upgrade", "fast"] as const).includes(
    (body as any).variant
  )
    ? (body as any).variant
    : "basic";

  const base = names.length ? names : ["яйца", "лук", "шампиньоны"];
  const { system, user, temperature } = makePrompts(base, stock, variant);

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "OPENAI_API_KEY missing" }), { status: 500 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const stream = await client.chat.completions.create({
    model,
    temperature,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  let fullText = "";
  const encoder = new TextEncoder();

  const bodyStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream as any) {
          const delta = chunk?.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(JSON.stringify({ delta }) + "\n"));
          }
        }
        controller.enqueue(encoder.encode(JSON.stringify({ done: true, fullText }) + "\n"));
        controller.close();

        // (опционально) лёгкий лог вместо БД
        try {
          const latencyMs = Date.now() - t0;
          const approxTokens = Math.max(1, Math.round(fullText.length / 4));
          console.log("[recipes/stream] done", {
            variant,
            approxTokens,
            latencyMs,
            sessionId: req.headers.get("x-session-id") || randomUUID(),
          });
        } catch {}
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ error: "stream_failed" }) + "\n"));
        controller.close();
      }
    },
  });

  return new Response(bodyStream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
