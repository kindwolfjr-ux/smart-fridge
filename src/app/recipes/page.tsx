"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import RecipeCard from "@/components/recipe-card";
import type { RecipeDto } from "@/types/recipe";

type RecipeWithLead = RecipeDto & { lead?: string };

type RecipesResponseWithLead = {
  ok: boolean;
  products: string[];
  recipes: RecipeWithLead[];
  trace?: { leads?: string[] } | Record<string, unknown>;
};

type StoredPayload = {
  products: string[];
  data: RecipesResponseWithLead;
} | null;

export default function RecipesPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<RecipesResponseWithLead | null>(null);
  const [loading, setLoading] = useState(true);

  const urlItems = useMemo<string[]>(() => {
    const s = searchParams.get("items") ?? "";
    return s
      ? s
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean)
          .sort()
      : [];
  }, [searchParams]);

  const stored: StoredPayload = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("recipes_payload");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredPayload;
    } catch {
      return null;
    }
  }, []); // читаем один раз — этого достаточно

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let shouldFetch = true;

      // 1) пробуем sessionStorage-кэш
      if (stored?.data?.ok) {
        const storedItems = Array.isArray(stored.products)
          ? stored.products.map((x) => x.trim().toLowerCase()).filter(Boolean).sort()
          : [];
        if (JSON.stringify(storedItems) === JSON.stringify(urlItems)) {
          if (!cancelled) {
            setData(stored.data);
            setLoading(false);
          }
          shouldFetch = false;
        }
      }

      // 2) иначе — запрос
      if (!shouldFetch) return;

      if (!cancelled) setLoading(true);

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: urlItems }),
      });

      if (!res.ok) {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      const json = (await res.json()) as {
        ok: boolean;
        products: string[];
        recipes: RecipeDto[];
        trace?: { leads?: string[] } | Record<string, unknown>;
      };

      const withLead: RecipeWithLead[] = (json.recipes ?? []).map(
        (r: RecipeDto, i: number) => ({
          ...r,
          lead:
            (typeof json.trace === "object" &&
              json.trace &&
              Array.isArray((json.trace as { leads?: unknown[] }).leads) &&
              ((json.trace as { leads?: unknown[] }).leads![i] as string | undefined)) ||
            undefined,
        })
      );

      const enriched: RecipesResponseWithLead = {
        ok: Boolean(json.ok),
        products: Array.isArray(json.products) ? json.products : urlItems,
        recipes: withLead,
        trace: json.trace,
      };

      if (!cancelled) {
        setData(enriched);
        sessionStorage.setItem(
          "recipes_payload",
          JSON.stringify({ products: urlItems, data: enriched })
        );
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [urlItems, stored]); // ok: stored мемоизирован пустыми deps и не меняется

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
