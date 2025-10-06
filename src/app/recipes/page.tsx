"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import RecipeCard from "@/components/recipe-card";
import type { RecipeDto } from "@/types/recipe";

// локальный тип, чтобы не трогать глобальные
type RecipeWithLead = RecipeDto & { lead?: string };
type RecipesResponseWithLead = {
  recipes: RecipeWithLead[];
  trace?: { leads?: string[] };
  [k: string]: any;
};

export default function RecipesPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<RecipesResponseWithLead | null>(null);
  const [loading, setLoading] = useState(true);

  // --- список продуктов из URL ---
  const urlItems = useMemo(() => {
    const s = searchParams.get("items") ?? "";
    return s
      ? s
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean)
          .sort()
      : [];
  }, [searchParams]);

  useEffect(() => {
    const payloadRaw =
      typeof window !== "undefined"
        ? sessionStorage.getItem("recipes_payload")
        : null;

    let shouldFetch = true;

    if (payloadRaw) {
      try {
        const payload = JSON.parse(payloadRaw);
        const storedItems = Array.isArray(payload?.products)
          ? payload.products.map((x: string) => x.trim().toLowerCase()).filter(Boolean).sort()
          : [];

        if (JSON.stringify(storedItems) === JSON.stringify(urlItems)) {
          // тут уже должен быть приклеенный lead из /confirm
          setData(payload.data);
          setLoading(false);
          shouldFetch = false;
        }
      } catch {
        // no-op: просто сделаем fetch ниже
      }
    }

    (async () => {
      if (!shouldFetch) return;
      setLoading(true);

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: urlItems }),
      });

      const json = await res.json();

      // === приклеиваем lead по индексу, если пришёл в trace.leads ===
      const withLead: RecipeWithLead[] = (json.recipes ?? []).map(
        (r: RecipeDto, i: number) => ({
          ...r,
          lead: json?.trace?.leads?.[i] ?? undefined,
        })
      );

      const enriched: RecipesResponseWithLead = { ...json, recipes: withLead };
      setData(enriched);

      // кэшируем для «Назад»
      sessionStorage.setItem(
        "recipes_payload",
        JSON.stringify({ products: urlItems, data: enriched })
      );

      setLoading(false);
    })();
  }, [urlItems.join(",")]);

  if (loading) return <div className="p-6 text-gray-500">Загружаем рецепты...</div>;

  if (!data) {
    return (
      <div className="p-6 text-gray-500">
        Не удалось загрузить рецепты. Попробуйте снова.
      </div>
    );
  }

  return (
    <main className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Ваши рецепты</h1>

      {data.recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
    </main>
  );
}
