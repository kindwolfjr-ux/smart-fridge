// src/app/api/recipes/stream/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { anonIdFrom } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Variant = "basic" | "creative" | "upgrade" | "fast";

// UUID v4 валидатор (для session_id)
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
              typeof x?.amount === "string"
                ? Number(String(x.amount).replace(",", "."))
                : x?.amount,
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
        `- ${s.name}${
          typeof s.amount === "number" ? `: ${s.amount}` : ""
        }${s.unit ? ` ${s.unit}` : ""}`
    )
    .join("\n");

  const commonSystem = `
Ты — кулинарный помощник. Пиши ОДИН рецепт из заданных продуктов по шагам.
Если у пользователя есть количества, учитывай их и не превышай явный остаток.
Сразу под названием добавь строку: «⏱ <минуты> • <порции>».
Не добавляй служебный текст. Пиши по-русски.
Формат вывода (обычный текст):
# Название
Короткий лид (2–3 предложения)
Шаг 1 — ...
Шаг 2 — ...
Шаг 3 — ...
`.trim();

  const baseUser = [
    `Продукты: ${base.join(", ")}.`,
    stockLines ? "\nС учётом количеств:\n" + stockLines : "",
  ]
    .join("")
    .trim();

  if (variant === "basic") {
    return {
      system:
        commonSystem +
        `
Требование: базовое повседневное блюдо (быстрое, мало действий, минимум «креатива»).
Используй только продукты пользователя + базовые кладовые (соль, перец, масло, вода, мука).
Запрещено предлагать дополнительные покупки.`.trim(),
      user: baseUser,
      temperature: 0.4,
    };
  }

  if (variant === "fast") {
    return {
      system:
        commonSystem +
        `
Требование: «на скорую руку» — рецепт, который готовится за 7–10 минут TOTAL, минимум действий.
Используй только продукты пользователя + базовые кладовые.
Состав ингредиентов укажи с конкретными количествами (если возможно), не превышая доступный остаток.`.trim(),
      user: baseUser,
      temperature: 0.3,
    };
  }

  if (variant === "creative") {
    return {
      system:
        commonSystem +
        `
Требование: интересное блюдо (новая форма/техника: запекание, соус, карамелизация и т.п.).
Используй только продукты пользователя + базовые кладовые. Без новых покупок.
Избегай совпадения идеи с базовым вариантом.`.trim(),
      user: baseUser,
      temperature: 0.8,
    };
  }

  // upgrade
  return {
    system:
      commonSystem +
      `
Требование: «апгрейд-версия» — вкусное и интересное блюдо,
которое можно приготовить, если ДОКУПИТЬ не более 3 доп. ингредиентов.
Сначала придумай рецепт, затем аккуратно вплети до 3 дополнительных ингредиентов.
В конце добавь строку: Дополнительно: <ингредиент 1>, <ингредиент 2>, <ингредиент 3>
Если хватает текущих продуктов — предложи 1–2 усилителя вкуса (например: пармезан, лимон).`.trim(),
    user: baseUser,
    temperature: 0.7,
  };
}

// NDJSON-стрим: {"delta": "..."} ... {"done":true,"fullText":"..."}
export async function POST(req: NextRequest) {
  const t0 = Date.now();

  const body = await req.json().catch(() => ({}));
  const { names, stock } = normalizeStock((body as any).products);

  const variant: Variant =
    (["basic", "creative", "upgrade", "fast"] as const).includes(
      (body as any).variant
    )
      ? (body as any).variant
      : "basic";

  const base = names.length ? names : ["яйца", "лук", "шампиньоны"];
  const { system, user, temperature } = makePrompts(base, stock, variant);

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
            controller.enqueue(
              encoder.encode(JSON.stringify({ delta }) + "\n")
            );
          }
        }

        // закрываем стрим
        controller.enqueue(
          encoder.encode(JSON.stringify({ done: true, fullText }) + "\n")
        );
        controller.close();

        // ── серверная аналитика token_spent (приблизительно для стрима) ──
        try {
          const rawUid = req.cookies.get("uid")?.value ?? randomUUID();
          const anonId = anonIdFrom(rawUid);

          const sidHeader = req.headers.get("x-session-id") || "";
          const sessionId = uuidV4.test(sidHeader) ? sidHeader : randomUUID();

          const latencyMs = Date.now() - t0;

          // приблизительная оценка токенов по длине текста (≈ 4 символа / токен)
          const charCount = fullText.length;
          const approxTotalTokens = Math.max(1, Math.round(charCount / 4));

          await supabaseAdmin.from("events").insert({
            ts: new Date().toISOString(),
            anon_user_id: anonId,
            session_id: sessionId,
            name: "token_spent",
            payload: {
              provider: "OpenAI",
              model,
              variant,
              // usage в stream недоступен — логируем приближение
              input_tokens: null,
              output_tokens: null,
              total_tokens: null,
              approx_total_tokens: approxTotalTokens,
              char_count: charCount,
              latency_ms: latencyMs,
              router: "app/api/recipes/stream",
            },
            ua: "server",
          });
        } catch (e) {
          console.error("analytics token_spent (stream) failed:", e);
        }
      } catch {
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: "stream_failed" }) + "\n")
        );
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
