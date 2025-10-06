// src/app/api/recipes/route.ts
import type { RecipeDto } from "@/types/recipe";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/** ——— Утилиты ——— */

function uuid() {
  // безопасный генератор id
  // @ts-ignore
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function normalizeProducts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const arr = input
    .map(x => (typeof x === "string" ? x : String(x ?? "")))
    .map(s => s.trim().toLowerCase())
    .filter((s): s is string => s.length > 0);
  return Array.from(new Set(arr)).sort();
}

function minutesFromText(s: string): number | undefined {
  const m = s.match(/(\d{1,3})\s*(мин|minutes?|минут[уы]?)/i);
  return m ? Number(m[1]) : undefined;
}

function splitAmountUnit(qty: string | undefined): { amount?: number; unit?: string } {
  if (!qty) return {};
  // Примеры: "200 г", "1 шт", "2–3 ст.л.", "0.5 ч.л.", "150 мл"
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
    // вырезаем последний JSON из текста
    const m = text.match(/\{[\s\S]*\}$/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

/** ——— Промпты ——— */

const SYSTEM_PROMPT = `
Ты — кулинарный помощник. Генерируй РОВНО 3 разнотипных рецепта из заданных продуктов.

Для КАЖДОГО рецепта верни поля:
— title
— lead: 2–3 предложения вводного текста о блюде (что это, вкус, почему зайдёт).
— time: { prep, cook, total } в минутах
— servings: целое число
— ingredients: [{ item, quantity }] с метрикой (г, мл, шт, ч.л., ст.л.)
— equipment: ["сковорода", "духовка", ...]
— steps: массив строк. КАЖДЫЙ шаг в формате «Заголовок — подробное пояснение». Запрещено повторять заголовок в пояснении. Примеры заголовков: «Нарежьте ингредиенты», «Обжарьте овощи», «Соберите соус». Пояснение должно быть конкретным: температуры, тайминги, режимы.
— tips: 2–4 заметки (замены, как сделать соус гуще/реже, хранение).

Ограничения:
— Используй только перечисленные продукты + базовые «кладовые» (соль, перец, сахар, вода, масло, мука, крахмал, уксус, соевый соус).
— Если чего-то не хватает — предложи замену в tips, но новых ингредиентов в список не добавляй.
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
Без лишнего текста вне JSON.
`.trim();


function userPrompt(products: string[]) {
  return [
    "Вот продукты пользователя (через запятую):",
    products.join(", "),
    "",
    "Сгенерируй три РАЗНЫХ рецепта:",
    "1) быстрый будничный;",
    "2) на сковороде или в духовке;",
    "3) с соусом или запеканием.",
    "Шаги строго в формате «Заголовок — пояснение», без повторов. Соблюдай JSON из system.",
  ].join("\n");
}


/** ——— Тип для ответа модели ——— */
type ModelRecipe = {
  title: string;
  time?: { prep?: number; cook?: number; total?: number };
  servings?: number;
  ingredients?: { item: string; quantity?: string }[];
  equipment?: string[];
  steps?: string[];
  tips?: string[];
};
type ModelResponse = { recipes?: ModelRecipe[] };

/** ——— Маппер в наш RecipeDto ——— */
function mapToDto(model: ModelRecipe[]): RecipeDto[] {
  return model.slice(0, 3).map((r, i) => {
    const ingredients = (r.ingredients ?? []).map(it => {
      const { amount, unit } = splitAmountUnit(it.quantity);
      return {
        name: it.item,
        amount,
        unit
      };
    });

    const steps = (r.steps ?? []).map((s, idx) => {
  // Разделяем «Заголовок — пояснение» или «Заголовок: пояснение»
  const parts = s.split(/—|:/).map(x => x.trim()).filter(Boolean);
  const action = parts[0] || "Шаг";
  let detail = parts.slice(1).join(" — ").trim();

  // если модель всё же продублировала — убираем повторы
  if (!detail || detail.toLowerCase() === action.toLowerCase()) {
    detail = "";
  }

  const duration_min = minutesFromText(s);
  return {
    order: idx + 1,
    action,
    ...(detail ? { detail } : {}),       // не отправляем пустое описание
    ...(duration_min ? { duration_min } : {})
  };
});


    const totalMin =
      (r.time?.total ?? ((r.time?.prep ?? 0) + (r.time?.cook ?? 0))) ||
      (steps.length ? steps.length * 3 : 15);

    const servings = r.servings && r.servings > 0 ? `${r.servings} порции` : "2 порции";

    return {
      id: uuid(),
      title: r.title || `Рецепт #${i + 1}`,
      portion: servings,
      time_min: totalMin,
      ingredients,
      steps
    };
  });
}

/** ——— Хэндлеры ——— */

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, note: "Используй POST с { products: string[] }" }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const startedAt = new Date().toISOString();
  let body: unknown = {};
  try { body = await req.json(); } catch {}

  const products = normalizeProducts((body as any)?.products);
  const base = products.length ? products : ["яйца", "лук", "шампиньоны"];

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // модель можно переопределить через переменную окружения
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  let leads: string[] = []; // сюда соберём вводные абзацы


  let dtoRecipes: RecipeDto[] = [];

  try {
    const resp = await client.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(base) }
      ]
    });

    const text = resp.choices?.[0]?.message?.content ?? "{}";
    const data = safeJsonParse<ModelResponse>(text);

    leads = Array.isArray(data?.recipes)
  ? (data!.recipes as any[]).map(r => r.lead).filter(Boolean)
  : [];


    const modelRecipes = Array.isArray(data?.recipes) ? (data!.recipes as ModelRecipe[]) : [];
    if (modelRecipes.length >= 1) {
      dtoRecipes = mapToDto(modelRecipes);
    }
  } catch (e) {
    // упадём на фолбэк ниже
  }

  // Фолбэк, если модель не вернула валидный JSON
  if (dtoRecipes.length !== 3) {
    const fallback: RecipeDto = {
      id: uuid(),
      title: `Быстрый рецепт: ${base.slice(0, 3).join(", ")}`,
      portion: "2 порции",
      time_min: 15,
      ingredients: base.map((p, idx) => ({
        name: p,
        amount: idx === 0 ? 2 : undefined,
        unit: idx === 0 ? "шт" : undefined
      })),
      steps: [
        { order: 1, action: "Подготовить", detail: "нарезать ингредиенты", duration_min: 3 },
        { order: 2, action: "Обжарить", detail: "на сковороде на среднем огне", duration_min: 7 },
        { order: 3, action: "Довести", detail: "посолить, подать", duration_min: 5 }
      ]
    };

    // делаем 3 варианта, чтобы фронт всегда получал 3
    dtoRecipes = [
      fallback,
      { ...fallback, id: uuid(), title: fallback.title + " — вариант 2" },
      { ...fallback, id: uuid(), title: fallback.title + " — вариант 3" }
    ];
  }

return new Response(
  JSON.stringify({
    ok: true,
    products,
    recipes: dtoRecipes,
    trace: {
      router: "app",
      ts: startedAt,
      model,
      leads // <-- новые вводные тексты по каждому рецепту (если модель их дала)
    }
  }),
  { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }
);

}
