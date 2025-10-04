import { NextRequest, NextResponse } from "next/server";
import { BASIC_ALLOWED, canonicalizeList } from "@/lib/food-normalize";
import { buildAllowed } from "@/lib/recipes-helpers";
import { sanitizeResponse } from "@/lib/recipes-sanitize";
import { type RecipesResponse } from "@/types/recipe";

// === ваш клиент OpenAI (пример) ===
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// KV (опционально)
const useKV = !!process.env.KV_URL && !!process.env.KV_REST_API_TOKEN;
const KV_NAMESPACE = "recipes_v2";

export const runtime = "edge"; // если используете edge
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = /* из секции 2.3 */ `
... тот самый SYSTEM_PROMPT ...
`;

function userPrompt(allowed: string[], portionDefault = "2 порции"): string {
  // из секции 2.3
  return `
Дано:
- Разрешенные ингредиенты (allowed): ${JSON.stringify(allowed)}
- Порции по умолчанию: "${portionDefault}"

Сгенерируй 3 рецепта, строго следуя схеме. Помни:
- Никаких посторонних продуктов за пределами allowed + (соль, перец, масло, вода).
- Реальные шаги (вода, соль, время, температура), 3–8 шагов.
- Кол-ва и единицы: целые числа, "г|мл|ст. л.|ч. л.".

Верни ТОЛЬКО JSON по схеме, без текста.`;
}

// простая KV-обертка (опционально)
async function kvGet(key: string): Promise<string | null> {
  if (!useKV) return null;
  const res = await fetch(`${process.env.KV_URL}/get/${KV_NAMESPACE}:${key}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null) as any;
  return json?.result ?? null;
}

async function kvSet(key: string, value: string, ttlSec = 60 * 60 * 24) {
  if (!useKV) return;
  await fetch(`${process.env.KV_URL}/set/${KV_NAMESPACE}:${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value, expiration: Math.floor(Date.now() / 1000) + ttlSec }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userItems: string[] = Array.isArray(body?.products) ? body.products : [];
    const canonUser = canonicalizeList(userItems);

    // allowed = userItems ∪ базовые
    const allowedSet = buildAllowed(userItems);
    const allowed = Array.from(allowedSet);

    // cacheKey: отсортированный список userItems
    const cacheKey = `v2::${canonUser.sort().join("|")}`;
    const cached = await kvGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return NextResponse.json(parsed satisfies RecipesResponse);
    }

    // Вызов модели
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(allowed) },
      ],
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    let rawJson: unknown;
    try { rawJson = JSON.parse(rawText); } catch { rawJson = {}; }

    // Санитация/валидирование/пост-обработка
    const clean = sanitizeResponse(rawJson, new Set(allowed));

    // Кэшируем
    await kvSet(cacheKey, JSON.stringify(clean));

    return NextResponse.json(clean);
  } catch (e) {
    console.error("/api/recipes error", e);
    return NextResponse.json({ recipes: [] }, { status: 500 });
  }
}
