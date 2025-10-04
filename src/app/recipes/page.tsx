"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import RecipeCard from "@/components/recipe-card";
import type { RecipesResponse } from "@/types/recipe";

export default function RecipesPage() {
  const searchParams = useSearchParams(); // ✅ правильный способ получения query в Next.js 15
  const [data, setData] = useState<RecipesResponse | null>(null);
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

  // --- логика загрузки / кэширования ---
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
          ? payload.products
              .map((x: string) => x.trim().toLowerCase())
              .filter(Boolean)
              .sort()
          : [];

        // 🔍 если список совпадает, берём из sessionStorage
        if (JSON.stringify(storedItems) === JSON.stringify(urlItems)) {
          setData(payload.data);
          setLoading(false);
          shouldFetch = false;
        }
      } catch {
        // если что-то не так — просто делаем запрос заново
      }
    }

    // 🚀 если данных нет или список другой — грузим заново
    (async () => {
      if (!shouldFetch) return;
      setLoading(true);

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: urlItems }),
      });

      const json = await res.json();
      setData(json);

      // кэшируем для возврата "Назад"
      sessionStorage.setItem(
        "recipes_payload",
        JSON.stringify({ products: urlItems, data: json })
      );

      setLoading(false);
    })();
  }, [urlItems.join(",")]);

  // --- отображение ---
  if (loading)
    return <div className="p-6 text-gray-500">Загружаем рецепты...</div>;

  if (!data)
    return (
      <div className="p-6 text-gray-500">
        Не удалось загрузить рецепты. Попробуйте снова.
      </div>
    );

  return (
    <main className="p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Ваши рецепты</h1>

      {data.recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
    </main>
  );
}
