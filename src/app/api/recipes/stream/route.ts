// src/app/api/recipes/stream/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Variant = "basic" | "creative" | "upgrade";

function normalizeProducts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.map((x) => String(x ?? "")).map((s) => s.trim().toLowerCase()).filter(Boolean)
    )
  ).sort();
}

function makePrompts(base: string[], variant: Variant) {
  const commonSystem = `
Ты — кулинарный помощник. Пиши ОДИН рецепт из заданных продуктов по шагам.
Не добавляй служебный текст. Пиши по-русски.
Формат вывода (обычный текст):
# Название
Короткий лид (2–3 предложения)
Шаг 1 — ...
Шаг 2 — ...
Шаг 3 — ...
`.trim();

  if (variant === "basic") {
    return {
      system: commonSystem + `
Требование: базовое повседневное блюдо (быстрое, мало действий, минимум «креатива»).
Используй только продукты пользователя + базовые кладовые (соль, перец, масло, вода, мука).
Запрещено предлагать дополнительные покупки.
`.trim(),
      user: `Продукты: ${base.join(", ")}.`,
      temperature: 0.4,
    };
  }

  if (variant === "creative") {
    return {
      system: commonSystem + `
Требование: интересное блюдо (новая форма/техника: запекание, соус, карамелизация и т.п.).
Используй только продукты пользователя + базовые кладовые. Без новых покупок.
Избегай совпадения идеи с базовым вариантом.
`.trim(),
      user: `Продукты: ${base.join(", ")}.`,
      temperature: 0.8,
    };
  }

  // upgrade
  return {
    system: commonSystem + `
Требование: «апгрейд-версия» — вкусное и интересное блюдо,
которое можно приготовить, если ДОКУПИТЬ не более 3 доп. ингредиентов.
Сначала придумай рецепт, затем аккуратно вплети до 3 дополнительных ингредиентов.
В конце добавь строку: Дополнительно: <ингредиент 1>, <ингредиент 2>, <ингредиент 3>
Если хватает текущих продуктов — предложи 1–2 точечных усилителя вкуса (например: пармезан, лимон).
`.trim(),
    user: `Продукты: ${base.join(", ")}.`,
    temperature: 0.7,
  };
}

// NDJSON-стрим: {"delta": "..."} ... {"done":true,"fullText":"..."}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const products = normalizeProducts((body as any).products);
  const variant: Variant = (["basic", "creative", "upgrade"] as const).includes(
    (body as any).variant
  )
    ? (body as any).variant
    : "basic";

  const base = products.length ? products : ["яйца", "лук", "шампиньоны"];
  const { system, user, temperature } = makePrompts(base, variant);

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
