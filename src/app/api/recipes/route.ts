// src/app/api/recipes/route.ts
import type { RecipeDto } from "@/types/recipe";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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
    .filter((s): s is string => s.length > 0); // <- типовой предикат
  return Array.from(new Set(arr)).sort();
}

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, note: "Используй POST с { products: string[] }" }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  let body: unknown = {};
  try { body = await req.json(); } catch {}

  const products: string[] = normalizeProducts((body as any)?.products);
  const base: string[] = products.length ? products : ["яйца", "лук", "шампиньоны"];

  const recipe: RecipeDto = {
    id: uuid(),
    title: base.length ? `Быстрый рецепт: ${base.slice(0, 3).join(", ")}` : "Пример рецепта",
    portion: "2 порции",
    time_min: 15,
    ingredients: base.map((p, idx) => ({
      name: p,
      amount: idx === 0 ? 2 : undefined,
      unit: idx === 0 ? "шт" : undefined,
    })),
    steps: [
      { order: 1, action: "Подготовить", detail: "нарезать ингредиенты", duration_min: 3 },
      { order: 2, action: "Обжарить", detail: "на сковороде", duration_min: 7 },
      { order: 3, action: "Довести", detail: "посолить, подать", duration_min: 5 },
    ],
  };

  return new Response(
    JSON.stringify({ ok: true, products, recipes: [recipe], trace: { router: "app", ts: new Date().toISOString() } }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }
  );
}
