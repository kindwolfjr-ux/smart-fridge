"use client";
import { useState } from "react";
import type { RecipeDto } from "@/types/recipe";

export default function RecipeCard({ recipe }: { recipe: RecipeDto }) {
  const [open, setOpen] = useState(false);

  const copyRecipe = () => {
    const text = [
      `${recipe.title} (${recipe.portion}, ~${recipe.time_min} мин)\n`,
      `\n🧂 Ингредиенты:`,
      ...recipe.ingredients.map(
        (i) =>
          `- ${i.name} — ${i.amount} ${i.unit}${i.note ? ` (${i.note})` : ""}`
      ),
      `\n👩‍🍳 Шаги:`,
      ...recipe.steps.map(
        (s) =>
          `${s.order}. ${s.action}: ${s.detail}${
            s.duration_min ? ` (~${s.duration_min} мин)` : ""
          }`
      ),
    ].join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="rounded-2xl border p-4 space-y-3 shadow-sm bg-white">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{recipe.title}</h3>
        <button
          onClick={copyRecipe}
          className="text-xs text-gray-500 hover:text-black"
        >
          📋 Скопировать
        </button>
      </div>

      {(recipe.time_min || recipe.portion) && (
        <p className="text-xs text-gray-500">
          {recipe.time_min ? `~${recipe.time_min} мин` : ""}
          {recipe.time_min && recipe.portion ? " • " : ""}
          {recipe.portion || ""}
        </p>
      )}

      {/* Инвентарь */}
      {recipe.equipment?.length > 0 && (
        <p className="text-sm text-gray-600">
          <span className="text-gray-500">Инвентарь:</span>{" "}
          {recipe.equipment.join(", ")}
        </p>
      )}

      {/* Ингредиенты */}
      <div className="text-sm text-gray-700">
        <span className="text-gray-500">Ингредиенты:</span>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          {recipe.ingredients.map((i, idx) => (
            <li key={idx}>
              {i.name} — {i.amount} {i.unit}
              {i.note ? ` (${i.note})` : ""}
            </li>
          ))}
        </ul>
      </div>

      {/* Кнопка раскрытия шагов */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center justify-center rounded-xl bg-black px-3 py-2 text-sm text-white hover:bg-black/90"
      >
        {open ? "Скрыть шаги" : "Показать шаги"}
      </button>

      {/* Шаги */}
      {open && recipe.steps?.length > 0 && (
        <ol className="mt-3 list-decimal pl-5 text-sm text-gray-800 space-y-1">
          {recipe.steps.map((s) => (
            <li key={s.order}>
              <span className="font-medium">{s.action}</span> — {s.detail}{" "}
              {s.duration_min ? (
                <span className="text-gray-500">(~{s.duration_min} мин)</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {/* Советы */}
      {recipe.tips?.length ? (
        <div className="mt-3 border-t pt-2 text-sm text-gray-600">
          <span className="font-medium">Советы:</span>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {recipe.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
