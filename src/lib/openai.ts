// src/lib/openai.ts
export type Recipe = {
  title: string;
  time_min: number;
  difficulty: "легко" | "средне" | "сложно";
  ingredients_used: string[];
  steps: string[];
};

const SYSTEM = `Ты — повар-технолог. Отвечай КРАТКО, строго в JSON-массиве из 3 объектов:
[
 { "title":"...", "time_min":15, "difficulty":"легко",
   "ingredients_used":["..."], "steps":["1) ...","2) ..."] }
]
Только 3 рецепта. Используй ТОЛЬКО продукты из списка + базовые: вода/соль/перец/масло.`;

const userPrompt = (list: string[]) =>
  `Список продуктов: ${list.join(", ")}.
Ограничения: 3 рецепта, суммарно ≤ 900 токенов. Короткие шаги (до 12 слов). Формат строго JSON-массив.`;

function safeParseJsonArray(raw: string): Recipe[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Recipe[];
  } catch {}
  const m = raw.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      if (Array.isArray(parsed)) return parsed as Recipe[];
    } catch {}
  }
  throw new Error("Модель вернула невалидный JSON");
}

// ВАЖНО: именованный экспорт (НЕ default)
export async function generateRecipes(products: string[]): Promise<Recipe[]> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(products) },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return safeParseJsonArray(content);
}
