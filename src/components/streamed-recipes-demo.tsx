// src/components/streamed-recipes-demo.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStreamedRecipe } from "@/lib/useStreamedRecipe";

type Props = {
  products: string[];
  hideTitle?: boolean; // можно передать, чтобы скрыть внутренний заголовок
};

export default function StreamedRecipesDemo({ products, hideTitle = false }: Props) {
  const p = useMemo(
    () => products.map((s) => s.trim()).filter(Boolean),
    [products]
  );

  const a = useStreamedRecipe(); // базовый рецепт
  const b = useStreamedRecipe(); // интересный рецепт
  const c = useStreamedRecipe(); // «апгрейд»-рецепт (по клику)

  // Запускаем два потока один раз при первом рендере
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (p.length === 0) return;
    startedRef.current = true;

    a.start({ products: p, variant: "basic" });
    b.start({ products: p, variant: "creative" });
  }, [p, a, b]);

  return (
    <div className="space-y-8">
      {/* внутренний заголовок показываем только если НЕ пришёл hideTitle */}
      {!hideTitle && (
        <h2 className="whitespace-nowrap text-[20px] sm:text-2xl font-extrabold tracking-tight text-[#1e1e1e] leading-tight mb-2">
          Ваши рецепты
        </h2>
      )}

      <RecipeStreamCard
        title="Базовый рецепт"
        subtitle="Простое и быстрое блюдо на каждый день"
        text={a.text}
        running={a.isRunning}
        error={a.error}
      />

      <RecipeStreamCard
        title="Что-то интересное"
        subtitle="Нестандартная идея: соус, запекание или карамелизация"
        text={b.text}
        running={b.isRunning}
        error={b.error}
      />

      <div className="pt-4 border-t border-border">
        {(c.isRunning || c.text) ? (
          // Сразу показываем карточку на месте кнопки
          <RecipeStreamCard
            title="Вкусный апгрейд"
            subtitle="То же самое, но вкуснее: добавь до 3 продуктов"
            text={c.text}
            running={c.isRunning}
            error={c.error}
          />
        ) : (
          // До клика — оранжевая CTA
          <button
            className="btn-peach w-full sm:w-auto rounded-[28px] px-6 py-4 font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => c.start({ products: p, variant: "upgrade" })}
          >
            Хочу ещё (вкусный апгрейд)
          </button>
        )}
      </div>
    </div>
  );
}

function RecipeStreamCard({
  title,
  subtitle,
  text,
  running,
  error,
}: {
  title: string;
  subtitle?: string;
  text: string;
  running: boolean;
  error: string | null;
}) {
  // Удаляем # и берём первую строку как заголовок, остальное — тело
  const clean = text.replace(/^#\s*/, "");
  const [firstLine, ...rest] = clean.split("\n");
  const body = rest.join("\n").trim();

  return (
    <div className="rounded-2xl border border-border bg-background p-5 text-base leading-relaxed text-foreground shadow-sm">
      <div className="font-semibold text-lg">{firstLine?.trim() || title}</div>
      {subtitle && <div className="text-sm text-gray-500 mb-2">{subtitle}</div>}

      <p className="whitespace-pre-wrap text-sm leading-6 mt-1">
        {body || (running ? "…" : "—")}
      </p>

      {running && (
        <div className="mt-2 text-xs text-gray-500 animate-pulse">
          Печатаем по мере генерации…
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-500">Ошибка: {error}</div>}
    </div>
  );
}
