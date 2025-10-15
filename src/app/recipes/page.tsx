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
      <main className="p-6 mx-auto space-y-6 text-center max-w-xl sm:max-w-2xl">
        <h1 className="whitespace-nowrap text-[22px] sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#1e1e1e] leading-tight">
          Ваши рецепты
        </h1>
        <section className="glass rounded-3xl border glass-border p-4 text-left text-slate-900">
          <p className="text-sm text-gray-600">
            Сначала добавьте продукты на главной странице.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="p-6 mx-auto space-y-6 text-center max-w-xl sm:max-w-2xl">
      <h1 className="whitespace-nowrap text-[22px] sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#1e1e1e] leading-tight">
        Ваши рецепты
      </h1>

      {/* стеклянная зона контента — как на главной */}
      <section className="glass rounded-3xl border glass-border p-4 text-left text-slate-900">
        {/* сам стрим рецептов */}
        <div className="grid gap-4">
          <StreamedRecipesDemo products={products} hideTitle />
        </div>
      </section>
    </main>
  );
}
