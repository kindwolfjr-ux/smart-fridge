// src/components/recipe-card.tsx
"use client";

import { useMemo, useState } from "react";
import type { RecipeDto, IngredientDto, StepDto } from "@/types/recipe";

export default function RecipeCard({
  recipe,
}: {
  recipe: RecipeDto & { lead?: string };
}) {
  const [open, setOpen] = useState(false);

  const isFast =
    typeof recipe.time_min === "number" && recipe.time_min <= 10;

  const usedProducts = useMemo(() => {
    const uniq = Array.from(
      new Set(
        (recipe.ingredients ?? [])
          .map((i) => (i?.name || "").trim())
          .filter(Boolean)
      )
    );
    return uniq.slice(0, 6);
  }, [recipe.ingredients]);

  const copyRecipe = () => {
    const text = [
      `${recipe.title} (${recipe.portion ?? "1 порция"}, ~${
        recipe.time_min ?? 15
      } мин)\n`,
      "🧾 Ингредиенты:",
      ...recipe.ingredients.map(
        (i: IngredientDto) =>
          `- ${i.name} — ${i.amount ?? ""} ${i.unit ?? ""}${
            i.note ? ` (${i.note})` : ""
          }`
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
    <article className="rounded-3xl border border-gray-200 bg-white/90 shadow-sm p-4 sm:p-5">
      {/* Заголовок + мета + копирование */}
      <header className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold text-[#1e1e1e] flex items-center gap-2">
            <span className="truncate">{recipe.title}</span>
            {isFast && (
              <span
                className="inline-flex items-center rounded-full border border-green-500 text-green-600 px-2 py-0.5 text-xs whitespace-nowrap"
                title="Быстрый рецепт (≤ 10 мин)"
              >
                ≤ 10 мин
              </span>
            )}
          </h3>

          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            ⏱ ~{recipe.time_min ?? 15} мин • {recipe.portion ?? "1 порция"}
          </p>
        </div>

        <button
          onClick={copyRecipe}
          className="btn-soft rounded-2xl px-3 py-1.5 text-[13px] font-semibold text-gray-900 shrink-0"
          title="Скопировать рецепт"
          aria-label="Скопировать рецепт"
        >
          📋 Копировать
        </button>
      </header>

      {/* Лид/подзаголовок */}
      {"lead" in recipe && recipe.lead && (
        <p className="mt-2 text-sm text-gray-600">{recipe.lead}</p>
      )}

      {/* Используемые продукты */}
      {usedProducts.length > 0 && (
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium">Используются:</span>{" "}
          {usedProducts.join(", ")}
        </p>
      )}

      {/* Ингредиенты */}
      <section className="mt-3">
        <h4 className="text-sm font-semibold text-[#1e1e1e]">
          Ингредиенты
        </h4>
        <ul className="mt-1 list-disc list-inside text-sm text-gray-700 space-y-0.5">
          {recipe.ingredients.map((i: IngredientDto, idx) => (
            <li key={idx}>
              {i.name}
              {i.amount && ` — ${i.amount}`}
              {i.unit && ` ${i.unit}`}
              {i.note && ` (${i.note})`}
            </li>
          ))}
        </ul>
      </section>

      {/* Шаги */}
      <section className="mt-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn-soft w-full rounded-2xl px-4 py-2 text-[15px] font-semibold text-gray-900"
        >
          {open ? "Скрыть шаги" : "Показать шаги"}
        </button>

        {open && (
          <ol className="mt-2 list-decimal list-inside text-sm space-y-1">
            {recipe.steps.map((s: StepDto) => (
              <li key={s.order}>
                <strong>{s.action}</strong>
                {s.detail && ` — ${s.detail}`}
                {s.duration_min && (
                  <span className="text-gray-500">
                    {" "}
                    (~{s.duration_min} мин)
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
