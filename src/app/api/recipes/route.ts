// app/api/recipes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BASIC_ALLOWED, canonicalizeList } from "@/lib/food-normalize";
import { buildAllowed } from "@/lib/recipes-helpers";
import { sanitizeResponse } from "@/lib/recipes-sanitize";
import { type RecipesResponse } from "@/types/recipe";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const runtime = "edge";
export const dynamic = "force-dynamic";

// === KV via REST (работает на Edge) ===
const KV_URL = process.env.KV_REST_API_URL;      // <— правильные названия
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKV = !!KV_URL && !!KV_TOKEN;
const KV_NAMESPACE = "recipes_v3";

async function kvGet(key: string): Promise<string | null> {
  if (!useKV) return null;
  const url = `${KV_URL}/get/${encodeURIComponent(`${KV_NAMESPACE}:${key}`)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null) as any;
  return json?.result ?? null;
}

async function kvSet(key: string, value: string, ttlSec = 60 * 60 * 24) {
  if (!useKV) return;
  // Upstash/Vercel KV поддерживает EX через /set/{key}/{value}?EX=ttl
  const url = `${KV_URL}/set/${encodeURIComponent(`${KV_NAMESPACE}:${key}`)}/${encodeURIComponent(value)}?EX=${ttlSec}`;
  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  }).catch(() => {});
}

const SYSTEM_PROMPT = `
Ты кулинарный ассистент. Верни СТРОГО ЧИСТЫЙ JSON по схеме:
{"recipes":[{"title":"string","ingredients":["string"],"steps":["string"],"time":"string","servings":"string"}]}
— Только продукты из allowed + соль/перец/масло/вода.
— 3 рецепта, каждый с 3–8 реальными шагами (время, огонь, когда солить/кипятить).
— Порции и время указывать явно.
— Никакого текста вне JSON.
`;


function userPrompt(allowed: string[], portionDefault = "2 порции"): string {
  return [
    `Allowed: ${JSON.stringify(allowed)}`,
    `Servings default: ${portionDefault}`,
    `Сгенерируй 3 подробных рецепта по строгой схеме выше.`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const noCache = url.searchParams.get("nocache") === "1";

    const body = await req.json();
    const userItems: string[] = Array.isArray(body?.products) ? body.products : [];
    const canonUser = canonicalizeList(userItems);

    const allowedSet = buildAllowed(userItems);
    const allowed = Array.from(allowedSet);

    // новый namespace — чтобы не ловить старый пустой кэш
    const cacheKey = `v4::${canonUser.sort().join("|")}`;
    const cached = !noCache ? await kvGet(cacheKey) : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      return NextResponse.json(debug ? { ...parsed, _from: "cache", cacheKey } : parsed);
    }

    // Вызов модели
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [
            `Allowed: ${JSON.stringify(allowed)}`,
            `Servings default: 2 порции`,
            `Сгенерируй 3 рецепта строго по схеме.`
          ].join("\n")
        },
      ],
      response_format: { type: "json_object" },
    });

    const llmText = completion.choices[0]?.message?.content ?? "{}";

    // Пытаемся распарсить как {"recipes":[...]}
    let out: any = {};
    try { out = JSON.parse(llmText); } catch {}
    let recipes: any[] = Array.isArray(out?.recipes) ? out.recipes : [];

    // Если пусто — даём фолбэк (чтобы UI не остался с пустотой)
    if (!recipes || recipes.length === 0) {
      recipes = [{
        title: "Омлет с помидорами и грибами",
        ingredients: ["яйца 3 шт", "помидоры 150 г", "шампиньоны 120 г", "лук 60 г", "масло 1 ст. л.", "соль", "перец"],
        steps: [
          "Нарежьте лук, помидоры и грибы.",
          "Разогрейте сковороду с маслом, обжарьте лук 3–4 мин.",
          "Добавьте грибы, жарьте 5–6 мин до испарения влаги.",
          "Добавьте помидоры, посолите, готовьте 2 мин.",
          "Взбейте яйца с щепоткой соли, вылейте на сковороду и готовьте 3–4 мин под крышкой."
        ],
        time: "15–20 мин",
        servings: "2 порции",
      }];
      // не кэшируем фолбэк
      const resp = { recipes };
      return NextResponse.json(debug ? { ...resp, _from: "fallback", llmText } : resp);
    }

    // Кэшируем только непустой результат
    const resp = { recipes };
    await kvSet(cacheKey, JSON.stringify(resp));

    return NextResponse.json(debug ? { ...resp, llmText } : resp);
  } catch (e) {
    console.error("/api/recipes error", e);
    return NextResponse.json({ recipes: [] }, { status: 500 });
  }
}

