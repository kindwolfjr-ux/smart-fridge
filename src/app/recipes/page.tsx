// src/app/recipes/page.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import StreamedRecipesDemo from "@/components/streamed-recipes-demo";

export default function RecipesPage() {
  const sp = useSearchParams();

  // продукты из ?items=яблоко,сыр,яйца
  const products = useMemo<string[]>(() => {
    const q = sp.get("items") || "";
    return q
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .sort();
  }, [sp]);

  if (products.length === 0) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Ваши рецепты</h1>
        <p className="text-sm text-gray-500">
          Сначала добавьте продукты на главной странице.
        </p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Ваши рецепты</h1>

      {/* Только стрим: два рецепта печатаются сразу, третий — по клику */}
      <StreamedRecipesDemo products={products} />

      {/* Если позже понадобится — сюда вернём карточки на основе распарсенного стрима */}
    </main>
  );
}
