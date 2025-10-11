// src/components/recipe-card.tsx
"use client";
import { useMemo, useState } from "react";
import type { RecipeDto, IngredientDto, StepDto } from "@/types/recipe";

export default function RecipeCard({ recipe }: { recipe: RecipeDto & { lead?: string } }) {
  const [open, setOpen] = useState(false);

  const isFast = typeof recipe.time_min === "number" && recipe.time_min <= 10;

  const usedProducts = useMemo(() => {
    const uniq = Array.from(
      new Set(
        (recipe.ingredients ?? [])
          .map((i) => (i?.name || "").trim())
          .filter(Boolean)
      )
    );
    return uniq.slice(0, 6); // компактный список
  }, [recipe.ingredients]);

  const copyRecipe = () => {
    const text = [
      `${recipe.title} (${recipe.portion ?? "1 порция"}, ~${recipe.time_min ?? 15} мин)\n`,
      "🧾 Ингредиенты:",
      ...recipe.ingredients.map(
        (i: IngredientDto) =>
          `- ${i.name} — ${i.amount ?? ""} ${i.unit ?? ""}${i.note ? ` (${i.note})` : ""}`
      ),
      "\n🧭 Шаги:",
      ...recipe.steps.map(
        (s: StepDto) =>
          `${s.order}. ${s.action}: ${s.detail ?? ""}${
            s.duration_min ? ` (~${s.duration_min} мин)` : ""
          }`
      ),
    ].join("\n");

    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="p-4 rounded-2xl shadow bg-white space-y-2">
      {/* Заголовок + время/порции + копирование */}
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="truncate">{recipe.title}</span>

            {/* Бейдж "быстро" для рецептов ≤ 10 мин */}
            {isFast && (
              <span
                className="inline-flex items-center rounded-full border border-green-500 text-green-600 px-2 py-0.5 text-xs whitespace-nowrap"
                title="Быстрый рецепт (≤ 10 мин)"
              >
                ≤ 10 мин
              </span>
            )}
          </h3>

          <div className="text-sm text-gray-500 mt-1">
            ⏱ ~{recipe.time_min ?? 15} мин • {recipe.portion ?? "1 порция"}
          </div>
        </div>

        <button
          onClick={copyRecipe}
          className="text-sm text-blue-600 hover:underline shrink-0"
          title="Скопировать рецепт"
          aria-label="Скопировать рецепт"
        >
          📋
        </button>
      </div>

      {/* lead — вводный абзац */}
      {"lead" in recipe && recipe.lead && (
        <p className="text-sm text-muted-foreground">{recipe.lead}</p>
      )}

      {/* Короткий список использованных продуктов */}
      {usedProducts.length > 0 && (
        <p className="text-sm text-gray-600">
          <span className="font-medium">Используются:</span>{" "}
          {usedProducts.join(", ")}
        </p>
      )}

      {/* Ингредиенты */}
      <div className="mt-1">
        <p className="font-medium">Ингредиенты:</p>
        <ul className="list-disc list-inside text-sm text-gray-700">
          {recipe.ingredients.map((i: IngredientDto, idx) => (
            <li key={idx}>
              {i.name}
              {i.amount && ` — ${i.amount}`}
              {i.unit && ` ${i.unit}`}
              {i.note && ` (${i.note})`}
            </li>
          ))}
        </ul>
      </div>

      {/* Кнопка раскрытия шагов */}
      <button
        onClick={() => setOpen(!open)}
        className="mt-3 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-md"
      >
        {open ? "Скрыть шаги" : "Показать шаги"}
      </button>

      {/* Шаги */}
      {open && (
        <ol className="list-decimal list-inside text-sm space-y-1 mt-2">
          {recipe.steps.map((s: StepDto) => (
            <li key={s.order}>
              <strong>{s.action}</strong>
              {s.detail && ` — ${s.detail}`}
              {s.duration_min && (
                <span className="text-gray-500"> (~{s.duration_min} мин)</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
