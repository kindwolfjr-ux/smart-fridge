import { cacheGet, cacheSet, makeRecipesKey } from "@/lib/cache";
import { randomUUID } from "crypto";
import type { RecipeDto } from "@/types/recipe";
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { anonIdFrom } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// —— важное: версия кэша, чтобы снести старые записи
const CACHE_VER = "fast-v2";

/** ——— Утилиты ——— */

function uuid() {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function minutesFromText(s: string): number | undefined {
  const m = s.match(/(\d{1,3})\s*(мин|minutes?|минут[уы]?)/i);
  return m ? Number(m[1]) : undefined;
}

function splitAmountUnit(qty: string | undefined): { amount?: number; unit?: string } {
  if (!qty) return {};
  const m = qty.match(/^(\d+(?:[\.,]\d+)?)(?:\s*[-–]\s*\d+(?:[\.,]\d+)?)?\s*([^\d]+)?$/);
  if (!m) return {};
  const amount = Number(m[1].replace(",", "."));
  const unit = (m[2] || "").trim() || undefined;
  return { amount: isNaN(amount) ? undefined : amount, unit };
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}$/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

/** ——— Вход и эвристика порций ——— */

type InItem = string | { name: string; amount?: number | string; unit?: string };

function normalizeInput(productsInput: unknown) {
  const arr: InItem[] = Array.isArray(productsInput) ? (productsInput as InItem[]) : [];
  const stock = arr
    .map((x) =>
      typeof x === "string"
        ? { name: x.trim().toLowerCase() }
        : {
            name: String((x as any)?.name ?? "").trim().toLowerCase(),
            amount:
              typeof (x as any)?.amount === "string"
                ? Number(String((x as any).amount).replace(",", "."))
                : (x as any)?.amount,
            unit: (x as any)?.unit ? String((x as any).unit).trim().toLowerCase() : undefined,
          }
    )
    .filter((x) => x.name);

  const names = Array.from(new Set(stock.map((x) => x.name))).sort();
  return { stock, names };
}

function estimateServingsFromStock(
  stock: { name: string; amount?: number; unit?: string }[]
): number | undefined {
  const isGram = (u?: string) => u && /(г|гр|грамм)/i.test(u);
  const isMl = (u?: string) => u && /(мл)/i.test(u);

  const sumBy = (pred: (n: string) => boolean) =>
    stock
      .filter((x) => (isGram(x.unit) || isMl(x.unit)) && typeof x.amount === "number" && pred(x.name))
      .reduce((acc, x) => acc + (x.amount ?? 0), 0);

  const proteinG = sumBy((n) => /(мяс|куриц|говяд|свин|индейк|филе|фарш|рыб|тунец|лосос|язык)/i.test(n));
  const pastaG = sumBy((n) => /(паст|спагет|макарон)/i.test(n));
  const grainG = sumBy((n) => /(рис|гречк|перлов|пшён|пшено|булгур|кус-кус|овсян)/i.test(n));
  const potatoG = sumBy((n) => /(картоф)/i.test(n));

  if (proteinG > 0) return Math.max(1, Math.round(proteinG / 180));
  if (pastaG > 0) return Math.max(1, Math.round(pastaG / 90));
  if (grainG > 0) return Math.max(1, Math.round(grainG / 80));
  if (potatoG > 0) return Math.max(1, Math.round(potatoG / 200));
  return undefined;
}

/** ——— Промпты ——— */

const SYSTEM_PROMPT = `
Ты — кулинарный помощник. Сгенерируй РОВНО 3 рецепта из продуктов пользователя.

Для КАЖДОГО рецепта верни поля (JSON):
— title
— lead (2–3 предложения)
— time: { prep, cook, total } (мин)
— servings: целое число (если возможно — учти реальный объём запасов)
— ingredients: [{ item, quantity }] — quantity с метрикой (г, мл, шт, ч.л., ст.л., "по вкусу")
— equipment: ["сковорода", "духовка", ...]
— steps: массив строк вида «Заголовок — пояснение» (не повторять заголовок в пояснении)
— tips: 2–4 заметки

Жёсткие требования:
— Используй ТОЛЬКО перечисленные продукты + базовые кладовые (соль, перец, масло, вода, мука, крахмал, уксус, соевый соус).
— Если у продукта указано количество/единица — учитывай это в ingredients и не превышай очевидный остаток.
— Рецепт №1 — базовый повседневный.
— Рецепт №2 — «на скорую руку»: общее время 7–10 минут, максимум 5 шагов,
  без духовки/долгих техник (только сковорода/микроволновка/без термообработки),
  минимум действий; ингредиентов не более 8 позиций.
— Рецепт №3 — более интересный приём (запекание/соус/карамелизация), но без экзотики и без покупок.
— Язык: русский.

Формат ответа — ТОЛЬКО JSON:
{
  "recipes": [
    {
      "title": "string",
      "lead": "string",
      "time": { "prep": number, "cook": number, "total": number },
      "servings": number,
      "ingredients": [{ "item": "string", "quantity": "string" }],
      "equipment": ["string"],
      "steps": ["Заголовок — пояснение", "..."],
      "tips": ["string"]
    },
    { ... }, { ... }
  ]
}
`.trim();

// Узкий промпт для 2-го "fast" рецепта
const SYSTEM_FAST_ONE = `
Ты — кулинарный помощник. Верни РОВНО ОДИН рецепт "на скорую руку" (7–10 минут total).
Ограничения:
— максимум 5 шагов, без духовки/томления/маринадов;
— разрешено: сковорода, микроволновка, без термообработки;
— ингредиентов не более 8 позиций;
— только продукты пользователя + базовые кладовые.
Формат — ТОЛЬКО JSON:
{
  "title": "string",
  "lead": "string",
  "time": { "prep": number, "cook": number, "total": number },
  "servings": number,
  "ingredients": [{ "item": "string", "quantity": "string" }],
  "equipment": ["string"],
  "steps": ["Заголовок — пояснение"],
  "tips": ["string"]
}
`.trim();

function userPrompt(
  products: string[],
  stock: { name: string; amount?: number; unit?: string }[],
  guessedServings?: number
) {
  const stockLines = stock
    .map((s) => `- ${s.name}${typeof s.amount === "number" ? `: ${s.amount}` : ""}${s.unit ? ` ${s.unit}` : ""}`)
    .join("\n");

  return [
    `Продукты пользователя: ${products.join(", ")}`,
    stockLines ? "\nС учётом количеств:\n" + stockLines : "",
    guessedServings ? `\nЕсли не уверены, ориентируйтесь на ${guessedServings} порции.`.replace("gu", "g") : "",
    "\nВерни JSON ровно с 3 рецептами по требованиям из system.",
  ]
    .join("")
    .trim();
}

/** ——— Типы ответа модели ——— */
type ModelRecipe = {
  title: string;
  lead?: string;
  time?: { prep?: number; cook?: number; total?: number };
  servings?: number;
  ingredients?: { item: string; quantity?: string }[];
  equipment?: string[];
  steps?: string[];
  tips?: string[];
};
type ModelResponse = { recipes?: ModelRecipe[] };

/** ——— Проверка fast-критериев ——— */
function isFastEnough(r?: ModelRecipe): boolean {
  if (!r) return false;
  const total = r.time?.total ?? (r.time?.prep ?? 0) + (r.time?.cook ?? 0);
  const stepsCnt = r.steps?.length ?? 0;
  const ingsCnt = r.ingredients?.length ?? 0;
  const text = [r.title, r.lead, ...(r.steps ?? []), ...(r.tips ?? []), ...(r.equipment ?? [])]
    .join(" ")
    .toLowerCase();

  const banned = /духовк|запека|марин|томл|конфи|су вид|slow cook/;
  return total >= 7 && total <= 10 && stepsCnt > 0 && stepsCnt <= 5 && ingsCnt > 0 && ingsCnt <= 8 && !banned.test(text);
}

async function regenerateFastRecipe(
  client: OpenAI,
  model: string,
  base: string[],
  stock: { name: string; amount?: number; unit?: string }[],
  guessedServings?: number
): Promise<ModelRecipe | null> {
  const stockLines = stock
    .map((s) => `- ${s.name}${typeof s.amount === "number" ? `: ${s.amount}` : ""}${s.unit ? ` ${s.unit}` : ""}`)
    .join("\n");

  const user = [
    `Продукты пользователя: ${base.join(", ")}`,
    stockLines ? "\nС учётом количеств:\n" + stockLines : "",
    guessedServings ? `\nЕсли не уверены, ориентируйтесь на ${guessedServings} порции.` : "",
    "\nВерни ровно 1 быстрый рецепт в JSON по требованиям из system.",
  ]
    .join("")
    .trim();

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_FAST_ONE },
      { role: "user", content: user },
    ],
  });

  const text = resp.choices?.[0]?.message?.content ?? "{}";
  return safeJsonParse<ModelRecipe>(text);
}

/** ——— Маппер в наш RecipeDto ——— */
function mapToDto(model: ModelRecipe[], guessedServings?: number): RecipeDto[] {
  return model.slice(0, 3).map((r, i) => {
    const rawIngredients = r.ingredients ?? [];
    const ingredients = rawIngredients.map((it) => {
      const { amount, unit } = splitAmountUnit(it.quantity);
      return { name: it.item, amount, unit };
    });

    const rawSteps = r.steps ?? [];
    const maxSteps = i === 1 ? 5 : rawSteps.length;
    const steps = rawSteps.slice(0, maxSteps).map((s, idx) => {
      const parts = s.split(/—|:/).map((x) => x.trim()).filter(Boolean);
      const action = parts[0] || "Шаг";
      let detail = parts.slice(1).join(" — ").trim();
      if (!detail || detail.toLowerCase() === action.toLowerCase()) detail = "";
      const duration_min = minutesFromText(s);
      return { order: idx + 1, action, ...(detail ? { detail } : {}), ...(duration_min ? { duration_min } : {}) };
    });

    const computedTotal =
  (r.time?.total ?? ((r.time?.prep ?? 0) + (r.time?.cook ?? 0))) ||
  (steps.length ? steps.length * 3 : 15);


    const isSecond = i === 1;
    const totalMin = isSecond ? Math.min(Math.max(7, computedTotal), 10) : computedTotal;

    const baseServ = r.servings && r.servings > 0 ? r.servings : guessedServings ?? 2;
    const servingsStr = `${baseServ} ${baseServ === 1 ? "порция" : baseServ < 5 ? "порции" : "порций"}`;

    const titleFromModel = r.title || `Рецепт #${i + 1}`;
    const title = isSecond ? "На скорую руку" : titleFromModel;

    return { id: uuid(), title, portion: servingsStr, time_min: totalMin, ingredients, steps };
  });
}

/** ——— Хэндлеры ——— */

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, note: "Используй POST с { products: string[] | {name,amount?,unit?}[] }" }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {}

  const productsInput =
    body && typeof body === "object" && "products" in (body as any)
      ? (body as { products: unknown }).products
      : undefined;

  const { stock, names } = normalizeInput(productsInput);
  const base = names.length ? names : ["яйца", "лук", "шампиньоны"];

  // ——— КЭШ c версией
  const cacheKey = `${makeRecipesKey(base)}::${CACHE_VER}`;

  // 1) попробуем взять из кэша, но только если 2-й рецепт быстрый
  try {
    const cached = await cacheGet<any>(cacheKey);
    const fastOk = Array.isArray(cached?.recipes) && cached.recipes[1]?.time_min <= 10;
    if (cached && fastOk) {
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  } catch {
    /* продолжаем без кэша */
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  let leads: string[] = [];
  let dtoRecipes: RecipeDto[] = [];
  let modelRecipes: ModelRecipe[] = [];
  const guessedServings = estimateServingsFromStock(stock);
  let usagePrompt = 0;
  let usageCompletion = 0;

  try {
    const resp = await client.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(base, stock, guessedServings) },
      ],
    });

    const text = resp.choices?.[0]?.message?.content ?? "{}";
    usagePrompt = (resp as any)?.usage?.prompt_tokens ?? 0;
    usageCompletion = (resp as any)?.usage?.completion_tokens ?? 0;

    const data = safeJsonParse<ModelResponse>(text);

    if (Array.isArray(data?.recipes)) {
      modelRecipes = data.recipes;
      leads = modelRecipes.map((r) => r.lead).filter((s): s is string => Boolean(s));

      // Проверяем 2-й рецепт; если не fast — перегенерим только его
      if (!isFastEnough(modelRecipes[1])) {
        const fastOne = await regenerateFastRecipe(client, model, base, stock, guessedServings).catch(() => null);
        if (fastOne && isFastEnough(fastOne)) modelRecipes[1] = fastOne;
      }
      dtoRecipes = mapToDto(modelRecipes, guessedServings);
    }
  } catch {
    /* упадём на фолбэк ниже */
  }

  // Фолбэк
if (dtoRecipes.length !== 3) {
  const mk = (title: string, time_min: number): RecipeDto => {
    return {
      id: uuid(),
      title,
      portion: `${(guessedServings ?? 2)} ${
        (guessedServings ?? 2) === 1 ? "порция" : (guessedServings ?? 2) < 5 ? "порции" : "порций"
      }`,
      time_min,
      ingredients: base.map((p, idx) => ({
        name: p,
        amount: idx === 0 ? 2 : undefined,
        unit: idx === 0 ? "шт" : undefined,
      })),
      steps: [
        { order: 1, action: "Подготовить", detail: "нарезать ингредиенты", duration_min: 3 },
        { order: 2, action: "Обжарить", detail: "на сковороде на среднем огне", duration_min: 4 },
        { order: 3, action: "Довести", detail: "посолить, подать", duration_min: 3 },
      ],
    };
  };

  dtoRecipes = [
    mk(`Базовый рецепт: ${base.slice(0, 3).join(", ")}`, 15),
    mk("На скорую руку", 9),
    mk(`Интересный вариант: ${base.slice(0, 3).join(", ")}`, 20),
  ];
}


  const result = {
    ok: true,
    products: base,
    recipes: dtoRecipes,
    trace: { router: "app", ts: startedAt, model, leads },
  };

  try {
    await cacheSet(cacheKey, result, 60 * 60 * 24);
  } catch {}

  // ✅ серверная аналитика: token_spent
  try {
    const rawUid = req.cookies.get("uid")?.value ?? randomUUID();
    const anonId = anonIdFrom(rawUid);
    const sessionId = req.headers.get("x-session-id") || randomUUID();
    const latencyMs = Date.now() - t0;

    await supabaseAdmin.from("events").insert({
      ts: new Date().toISOString(),
      anon_user_id: anonId,
      session_id: sessionId,
      name: "token_spent",
      payload: {
        provider: "OpenAI",
        model,
        input_tokens: usagePrompt,
        output_tokens: usageCompletion,
        latency_ms: latencyMs,
      },
    });
  } catch (e) {
    // не ломаем ответ пользователю, если аналитика не записалась
    console.error("analytics token_spent failed:", e);
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
