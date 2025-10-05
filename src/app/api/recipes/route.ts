// src/app/api/recipes/route.ts
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type Recipe = {
  title: string;
  ingredients: string[];
  steps: string[];
};

function normalizeProducts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((x) => (typeof x === 'string' ? x : String(x ?? '')))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort();
}

function sampleRecipes(products: string[]): Recipe[] {
  if (products.length === 0) {
    return [{
      title: 'Нечего готовить 🤷‍♂️',
      ingredients: [],
      steps: ['Передай в запросе products: string[]']
    }];
  }

  // Простой пример: делаем 1–2 рецепта на основе продуктов
  const titleBase = products.slice(0, 3).join(', ');
  return [
    {
      title: `Сковородка: ${titleBase}`,
      ingredients: [...products, 'соль', 'масло'],
      steps: [
        'Нарезать продукты',
        'Разогреть сковороду 2–3 минуты',
        'Обжарить 5–7 минут, помешивая',
        'Посолить, довести до готовности'
      ]
    },
    {
      title: `Салат: ${titleBase}`,
      ingredients: [...products, 'оливковое масло', 'щепотка соли'],
      steps: [
        'Порезать продукты кубиком',
        'Смешать в миске',
        'Заправить маслом и посолить',
        'Подать сразу'
      ]
    }
  ];
}

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, note: 'Используй POST с { products: string[] }' }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    }
  );
}


export async function POST(req: Request) {
  // Считываем тело максимально терпимо к формату
  let body: any = {};
  try {
    // Если приходит пусто или не-JSON — не падаем
    body = await req.json();
  } catch (_) {
    // noop
  }

  const products = normalizeProducts(body?.products);
  const recipes = sampleRecipes(products);

  return Response.json(
    {
      ok: true,
      products,
      recipes,
      trace: {
        ts: new Date().toISOString(),
        router: 'app',
        env: {
          vercel: !!process.env.VERCEL
        }
      }
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
