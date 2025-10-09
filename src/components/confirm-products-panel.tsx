"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeDto } from "@/types/recipe";

// один интерфейс пропсов: initialItems + onClear/onChange
type ConfirmProductsPanelProps = {
  /** стартовый список из распознавания */
  initialItems?: string[];
  onClear?: () => void;
  onChange?: (items: string[]) => void;
};

type RecipeWithLead = RecipeDto & { lead?: string };

export default function ConfirmProductsPanel({
  initialItems = [],
  onClear,
  onChange,
}: ConfirmProductsPanelProps) {
  const router = useRouter();

  const [items, setItems] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // заполняем из распознавания и обновляем при его смене
  useEffect(() => {
    const prepared = (initialItems ?? [])
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    setItems(prepared);
  }, [JSON.stringify(initialItems)]);

  const handleAdd = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !items.includes(trimmed)) {
      const next = [...items, trimmed];
      setItems(next);
      onChange?.(next);
    }
    setInput("");
  };

  const handleRemove = (name: string) => {
    const next = items.filter((i) => i !== name);
    setItems(next);
    onChange?.(next);
  };

  const handleClearAll = () => {
    setItems([]);
    onChange?.([]);
    onClear?.(); // сообщаем странице, чтобы спрятать панель и вернуть кнопку
  };

  async function handleGenerate() {
    if (items.length === 0 || submitting) return; // защита от пустоты и двойного клика
    setSubmitting(true);

    const key =
      "recipes:" +
      items
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join("|");

    try {
      // 0) client-cache
      try {
        const cachedRaw = localStorage.getItem(key);
        if (cachedRaw) {
          const enriched = JSON.parse(cachedRaw);
          sessionStorage.setItem(
            "recipes_payload",
            JSON.stringify({ products: items, data: enriched })
          );
          router.push(`/recipes?items=${encodeURIComponent(items.join(","))}`);
          return;
        }
      } catch {}

      // 1) запрос
      sessionStorage.removeItem("recipes_payload");

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: items }),
      });

      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);

      const json = await res.json();

      // 2) приклеиваем lead по индексу
      const withLead: RecipeWithLead[] = (json.recipes ?? []).map(
        (r: RecipeDto, i: number) => ({
          ...r,
          lead: json?.trace?.leads?.[i] ?? undefined,
        })
      );
      const enriched = { ...json, recipes: withLead };

      // 3) кладём в client-cache и session
      try {
        localStorage.setItem(key, JSON.stringify(enriched));
      } catch {}
      sessionStorage.setItem(
        "recipes_payload",
        JSON.stringify({ products: items, data: enriched })
      );

      router.push(`/recipes?items=${encodeURIComponent(items.join(","))}`);
    } catch (e) {
      console.error(e);
      alert("Не удалось получить рецепты. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <section className="p-6 max-w-md mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Подтвердите список продуктов</h2>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center justify-between border rounded-lg px-3 py-2"
            >
              <span>{item}</span>
              <button
                type="button"
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
          onKeyDown={onInputKeyDown}
          placeholder="Например: колбаса"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          autoComplete="off"
          inputMode="text"
          enterKeyHint="done"
          aria-label="Введите продукт"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="rounded-lg bg-black text-white px-3 py-2 text-sm hover:bg-black/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Добавить
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClearAll}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Очистить
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={items.length === 0 || submitting}
          className="flex-1 rounded-xl bg-green-600 text-white py-3 font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-busy={submitting}
        >
          {submitting ? "Генерируем рецепты…" : "Показать рецепты"}
        </button>
      </div>
    </section>
  );
}
