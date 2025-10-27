// src/app/recipes/page.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import StreamedRecipesDemo from "@/components/streamed-recipes-demo";

// ▼ добавлено
import FooterActions from "@/components/ui/FooterActions";
import SettingsButton from "@/components/ui/SettingsButton";
import RestartButton from "@/components/ui/RestartButton";

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

  // ▼ НОВОЕ: читаем фильтры из URL и передаем дальше
  const filters = {
    vegan: sp.get("vegan") === "1" || sp.get("vegan") === "true",
    halal: sp.get("halal") === "1" || sp.get("halal") === "true",
    noPork: sp.get("noPork") === "1" || sp.get("noPork") === "true",
    noSugar: sp.get("noSugar") === "1" || sp.get("noSugar") === "true",
  };

  if (products.length === 0) {
    return (
      <main className="p-6 pb-[calc(80px+env(safe-area-inset-bottom))] mx-auto space-y-6 text-center max-w-xl sm:max-w-2xl">
        <h1 className="whitespace-nowrap text-[22px] sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#1e1e1e] leading-tight">
          Ваши рецепты
        </h1>
        <section className="glass rounded-3xl border glass-border p-4 text-left text-slate-900">
          <p className="text-sm text-gray-600">
            Сначала добавьте продукты на главной странице.
          </p>
        </section>

        <FooterActions>
          <RestartButton />
          <SettingsButton />
        </FooterActions>
      </main>
    );
  }

  return (
    <main className="p-6 pb-[calc(80px+env(safe-area-inset-bottom))] mx-auto space-y-6 text-center max-w-xl sm:max-w-2xl">
      <h1 className="whitespace-nowrap text-[22px] sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#1e1e1e] leading-tight">
        Ваши рецепты
      </h1>

      <section className="glass rounded-3xl border glass-border p-4 text-left text-slate-900">
        <div className="grid gap-4">
          <StreamedRecipesDemo products={products} hideTitle filters={filters} />
        </div>
      </section>

      <FooterActions>
        <RestartButton />
        <SettingsButton />
      </FooterActions>
    </main>
  );
}
