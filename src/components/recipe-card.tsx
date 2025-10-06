"use client";
import { useState } from "react";
import type { RecipeDto, IngredientDto, StepDto } from "@/types/recipe";

export default function RecipeCard({ recipe }: { recipe: RecipeDto & { lead?: string } }) {
  const [open, setOpen] = useState(false);

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
          `${s.order}. ${s.action}: ${s.detail ?? ""}${s.duration_min ? ` (~${s.duration_min} мин)` : ""}`
      ),
    ].join("\n");

    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="p-4 rounded-2xl shadow bg-white space-y-2">
      {/* Заголовок */}
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold">{recipe.title}</h3>
        <button
          onClick={copyRecipe}
          className="text-sm text-blue-600 hover:underline"
          title="Скопировать рецепт"
        >
          📋
        </button>
      </div>

      {/* lead — вводный абзац */}
      {recipe.lead && (
        <p className="text-sm text-muted-foreground mb-2">{recipe.lead}</p>
      )}

      {/* Время и порции */}
      <p className="text-sm text-gray-500">
        ~{recipe.time_min ?? 15} мин • {recipe.portion ?? "1 порция"}
      </p>

      {/* Ингредиенты */}
      <div className="mt-2">
        <p className="font-medium">Ингредиенты:</p>
        <ul className="list-disc list-inside text-sm text-gray-700">
          {recipe.ingredients.map((i: IngredientDto, idx) => (
            <li key={idx}>
              {i.name}
              {i.amount && ` — ${i.amount}`}
              {i.unit && ` ${i.unit}`}
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
