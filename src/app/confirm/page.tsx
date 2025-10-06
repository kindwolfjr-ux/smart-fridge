"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecipeDto } from "@/types/recipe";

export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // продукты из URL ?items=паста,колбаса
  const urlItems = useMemo(() => {
    const s = searchParams.get("items") ?? "";
    return s
      ? s
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean)
      : [];
  }, [searchParams]);

  const [input, setInput] = useState("");
  const [items, setItems] = useState<string[]>([]);

  // заполнить список из URL при заходе
  useEffect(() => {
    if (urlItems.length) setItems(urlItems);
  }, [urlItems]);

  const handleAdd = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !items.includes(trimmed)) {
      setItems((prev) => [...prev, trimmed]);
      setInput("");
    }
  };

  const handleRemove = (name: string) => {
    setItems((prev) => prev.filter((i) => i !== name));
  };

  async function handleGenerate() {
    if (items.length === 0) return;

    // сбрасываем старые рецепты перед новым запросом
    sessionStorage.removeItem("recipes_payload");

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: items }),
    });

    const data = await res.json();

    // === ВАЖНО: приклеиваем lead к каждому рецепту по индексу ===
    const withLead = (data.recipes ?? []).map((r: RecipeDto, i: number) => ({
      ...r,
      lead: data?.trace?.leads?.[i] ?? undefined,
    }));

    // сохраняем в том же формате, что и раньше ({ products, data }),
    // но подменяем recipes на обогащённый массив
    sessionStorage.setItem(
      "recipes_payload",
      JSON.stringify({
        products: items,
        data: { ...data, recipes: withLead },
      })
    );

    router.push(`/recipes?items=${encodeURIComponent(items.join(","))}`);
  }

  return (
    <main className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Подтвердите список продуктов</h1>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center justify-between border rounded-lg px-3 py-2"
            >
              <span>{item}</span>
              <button
                onClick={() => handleRemove(item)}
                className="text-red-500 text-sm hover:underline"
              >
                удалить
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">
          Добавьте продукты вручную или отсканируйте холодильник.
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Например: колбаса"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleAdd}
          className="rounded-lg bg-black text-white px-3 py-2 text-sm hover:bg黑/90"
        >
          Добавить
        </button>
      </div>

      <button
        onClick={handleGenerate}
        disabled={items.length === 0}
        className="w-full mt-4 rounded-xl bg-green-600 text-white py-3 font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Показать рецепты
      </button>
    </main>
  );
}
