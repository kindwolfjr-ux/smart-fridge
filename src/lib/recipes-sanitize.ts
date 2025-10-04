import { z } from "zod";
import { normalizeUnit, clampAmount } from "./food-normalize";
import { titleFromIngredients } from "./recipes-helpers";

// === типы (чтобы не ругался TypeScript) ======================
export type IngredientItem = {
  name: string;
  amount: number;
  unit: string;
  note?: string;
};

export type StepItem = {
  order: number;
  action: string;
  detail: string;
  duration_min?: number;
  temperature_c?: number;
};

export type RecipeDto = {
  id: string;
  title: string;
  portion: string;
  time_min: number;
  equipment: string[];
  ingredients: IngredientItem[];
  steps: StepItem[];
  tips?: string[];
  nutrition?: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carb_g: number;
  };
};

export type RecipesResponse = { recipes: RecipeDto[] };

// === схема для валидации JSON от модели ======================
const IngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().int().nonnegative(),
  unit: z.enum(["г", "мл", "ст. л.", "ч. л."]),
  note: z.string().optional(),
});

const StepSchema = z.object({
  order: z.number().int().positive(),
  action: z.string().min(1),
  detail: z.string().min(1),
  duration_min: z.number().int().positive().optional(),
  temperature_c: z.number().int().positive().optional(),
});

const RecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  portion: z.string().min(1),
  time_min: z.number().int().positive(),
  equipment: z.array(z.string().min(1)).min(1),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(StepSchema).min(3).max(8),
  tips: z.array(z.string()).optional(),
  nutrition: z
    .object({
      kcal: z.number().int().nonnegative(),
      protein_g: z.number().int().nonnegative(),
      fat_g: z.number().int().nonnegative(),
      carb_g: z.number().int().nonnegative(),
    })
    .optional(),
});

const ResponseSchema = z.object({
  recipes: z.array(RecipeSchema).min(1),
});

// === основная функция =========================================
export function sanitizeResponse(raw: unknown, allowed: Set<string>): RecipesResponse {
  console.log("🧼 sanitizeResponse called with allowed:", [...allowed]);

  let parsed: RecipesResponse;
  try {
    parsed = ResponseSchema.parse(raw);
  } catch {
    parsed = { recipes: [] };
  }

  const clean: RecipeDto[] = [];

  for (const rec of parsed.recipes ?? []) {
    // --- 1) фильтруем ингредиенты только по allowed
    const filteredIngs = (rec.ingredients ?? []).filter((i) =>
      allowed.has(i.name.toLowerCase())
    );

    // --- 2) нормализуем единицы и количества
    const normIngs = filteredIngs
      .map((i) => {
        const unit = normalizeUnit(i.name, i.unit);
        const amount = clampAmount(i.name, i.amount);
        return { ...i, amount, unit };
      })
      .filter((i) => i.amount > 0);

    if (normIngs.length === 0) continue;

    // --- 3) проверяем title
    const lowerTitle = rec.title.toLowerCase();
    const hasForeign = lowerTitle
      .split(/\s|,|\./)
      .some((w) => w && !allowed.has(w.replace(/[^\p{L}]/gu, "")));
    const title = hasForeign ? titleFromIngredients(normIngs) : rec.title;

    // --- 4) корректируем шаги
    let steps = (rec.steps ?? []).slice().sort((a, b) => a.order - b.order);
    if (steps.length < 3) steps = toFallbackSteps(normIngs);
    steps = steps.slice(0, 8);

    // --- 5) дефолтное оборудование
    const equipment =
      rec.equipment?.length > 0
        ? rec.equipment
        : ["кастрюля 3 л", "сковорода", "нож", "доска", "дуршлаг"];

    // --- 6) время
    let time_min = rec.time_min;
    if (!Number.isFinite(time_min) || time_min <= 0) {
      const sum = steps.reduce((acc, s) => acc + (s.duration_min ?? 0), 0);
      time_min = sum || 25;
    }

    // --- 7) порции
    const portion = rec.portion?.trim() || "2 порции";

    clean.push({
      id: rec.id || cryptoRandomId(),
      title,
      portion,
      time_min: Math.round(time_min),
      equipment,
      ingredients: normIngs,
      steps,
      tips: rec.tips?.slice(0, 3),
      nutrition: rec.nutrition,
    });
  }

  // fallback если всё пусто
  if (clean.length === 0) clean.push(fallbackFromAllowed(allowed));

  return { recipes: clean };
}

// === вспомогательные функции ==================================
function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

function fallbackFromAllowed(allowed: Set<string>): RecipeDto {
  const ing = [
    allowed.has("паста") && { name: "паста", amount: 180, unit: "г" },
    allowed.has("колбаса") && { name: "колбаса", amount: 120, unit: "г" },
    { name: "вода", amount: 2000, unit: "мл", note: "для варки" },
    { name: "соль", amount: 1, unit: "ст. л." },
    { name: "масло", amount: 1, unit: "ст. л." },
  ].filter(Boolean) as IngredientItem[];

  return {
    id: cryptoRandomId(),
    title: "Простое блюдо из доступных продуктов",
    portion: "2 порции",
    time_min: 25,
    equipment: ["кастрюля 3 л", "сковорода", "нож", "доска", "дуршлаг"],
    ingredients: ing,
    steps: toFallbackSteps(ing),
    tips: ["Добавьте немного воды от пасты для сочности."],
  };
}

function toFallbackSteps(ingredients: { name: string }[]) {
  const hasPasta = ingredients.some((i) => i.name === "паста");
  const hasKolbasa = ingredients.some((i) => i.name === "колбаса");
  return [
    {
      order: 1,
      action: "Поставьте воду",
      detail: "В кастрюлю 2 л воды, 1 ст. л. соли. Доведите до кипения.",
      duration_min: 10,
      temperature_c: 100,
    },
    hasPasta
      ? {
          order: 2,
          action: "Отварите пасту",
          detail:
            "8–10 минут до аль денте, помешивайте. Сохраните 50 мл воды.",
          duration_min: 10,
        }
      : {
          order: 2,
          action: "Подготовьте продукты",
          detail: "Нарежьте ингредиенты и подготовьте сковороду.",
          duration_min: 5,
        },
    hasKolbasa
      ? {
          order: 3,
          action: "Обжарьте колбасу",
          detail: "На сухой сковороде 3–4 минуты, периодически помешивая.",
          duration_min: 4,
        }
      : {
          order: 3,
          action: "Соберите блюдо",
          detail: "Смешайте ингредиенты и прогрейте 2–3 минуты.",
          duration_min: 3,
        },
  ].filter(Boolean) as StepItem[];
}

export default sanitizeResponse; // ✅ чтобы import работал и с default, и с именованным
