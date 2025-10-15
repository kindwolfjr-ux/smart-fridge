"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeDto } from "@/types/recipe";
import { track, getSessionId } from "@/lib/analytics";
import { X } from "lucide-react";

type Unit = "g" | "ml" | "pcs";
type ProductQty = { name: string; detailed?: boolean; qty?: number; unit?: Unit };
type ConfirmProductsPanelProps = {
  initialItems?: string[];
  onClear?: () => void;
  onChange?: (items: string[]) => void;
  hideAction?: boolean;
  onChangeQty?: (items: ProductQty[]) => void;
};
type RecipeWithLead = RecipeDto & { lead?: string };

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/ё/g, "е");

function defaultUnitFor(name: string): Unit {
  const n = norm(name);
  const isLiquid = /(молок|сливк|вода|соус|масло|йогурт|кефир|морожен|бульон|сок|напит|молочн|слив)/.test(n);
  const isPiece = /(огурц|помидор|яйц|лук|яблок|банан|перец|томат|булоч|батон|зубчик|томат)/.test(n);
  const isLeafy = /(лист|зелень|базилик|укроп|петрушк|кинз)/.test(n);
  if (isLiquid) return "ml";
  if (isPiece || isLeafy) return "pcs";
  return "g";
}

export default function ConfirmProductsPanel({
  initialItems = [],
  onClear,
  onChange,
  onChangeQty,
  hideAction = false,
}: ConfirmProductsPanelProps) {
  const router = useRouter();

  const [items, setItems] = useState<ProductQty[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [qtyInput, setQtyInput] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  const lastEmittedRef = useRef<string>("");

  const emitChange = (next: ProductQty[]) => {
    const key = next
      .map((i) => (i.detailed ? `${norm(i.name)}:${i.qty ?? ""}${i.unit ?? ""}` : `${norm(i.name)}`))
      .join("|");
    if (key === lastEmittedRef.current) return;
    lastEmittedRef.current = key;
    onChange?.(next.map((i) => i.name));
    onChangeQty?.(next);
  };

  const normalizedInitial = useMemo<ProductQty[]>(() => {
    const seen = new Set<string>();
    const result: ProductQty[] = [];
    for (const raw of initialItems ?? []) {
      const name = String(raw).trim();
      if (!name) continue;
      const k = norm(name);
      if (seen.has(k)) continue;
      seen.add(k);
      result.push({ name, detailed: false });
    }
    return result;
  }, [initialItems]);

  const initialKeyRef = useRef<string>("");
  const initialKey = useMemo(
    () => (initialItems ?? []).map((x) => norm(String(x))).filter(Boolean).sort().join("|"),
    [initialItems]
  );

  useEffect(() => {
    const currentNamesKey = items.map((i) => norm(i.name)).sort().join("|");
    if (!initialKeyRef.current) {
      setItems(normalizedInitial);
      lastEmittedRef.current = normalizedInitial
        .map((i) => `${norm(i.name)}${i.detailed ? `:${i.qty}${i.unit}` : ""}`)
        .join("|");
      initialKeyRef.current = initialKey;
      return;
    }
    if (initialKey !== initialKeyRef.current && items.length === 0 && currentNamesKey === "") {
      setItems(normalizedInitial);
      lastEmittedRef.current = normalizedInitial
        .map((i) => `${norm(i.name)}${i.detailed ? `:${i.qty}${i.unit}` : ""}`)
        .join("|");
      initialKeyRef.current = initialKey;
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, normalizedInitial]);

  const canAdd = nameInput.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    const name = nameInput.trim();
    const k = norm(name);
    const existsIdx = items.findIndex((i) => norm(i.name) === k);
    if (existsIdx >= 0) {
      setNameInput("");
      setQtyInput("");
      return;
    }
    const next = [...items, { name, detailed: false }];
    setItems(next);
    emitChange(next);
    setNameInput("");
    setQtyInput("");
  };

  const handleRemove = (name: string) => {
    const next = items.filter((i) => norm(i.name) !== norm(name));
    setItems(next);
    emitChange(next);
  };

  const handleClearAll = () => {
    setItems([]);
    emitChange([]);
    onClear?.();
  };

  const toggleDetailed = (idx: number) => {
    const next = [...items];
    const it = next[idx];
    if (!it.detailed) {
      const unit = defaultUnitFor(it.name);
      next[idx] = { ...it, detailed: true, unit, qty: 1 };
    } else {
      next[idx] = { ...it, detailed: false, qty: undefined, unit: undefined };
    }
    setItems(next);
    emitChange(next);
  };

  const updateItem = (idx: number, patch: Partial<ProductQty>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
    emitChange(next);
  };

  const makeCacheKey = (arr: ProductQty[]) => {
    const mapped = arr.map((i) => ({
      n: norm(i.name),
      d: !!i.detailed,
      q: i.detailed ? Math.max(1, Number(i.qty) || 1) : undefined,
      u: i.detailed ? i.unit : undefined,
    }));
    mapped.sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
    return "recipes:" + mapped.map((i) => (i.d ? `${i.n}:${i.q}${i.u}` : i.n)).join("|");
  };

  const onNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  async function handleGenerate() {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);
    const key = makeCacheKey(items);
    const names = items.map((i) => i.name);
    const detailedItems = items
      .filter((i) => i.detailed && i.unit)
      .map((i) => {
        let q = Number(i.qty);
        if (!Number.isFinite(q) || q <= 0) q = 1;
        if (i.unit === "pcs") q = Math.max(1, Math.round(q));
        return { name: i.name.trim(), qty: q, unit: i.unit as Unit };
      });

    try {
      try {
        const cachedRaw = localStorage.getItem(key);
        if (cachedRaw) {
          const enriched = JSON.parse(cachedRaw);
          sessionStorage.setItem("recipes_payload", JSON.stringify({ products: names, data: enriched }));
          router.replace(`/recipes?items=${encodeURIComponent(names.join(","))}`);
          return;
        }
      } catch {}

      try {
        track("recipes_requested", { mode: "default", productsCount: names.length });
      } catch {}

      sessionStorage.removeItem("recipes_payload");
      const sid = getSessionId?.();

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(sid ? { "x-session-id": sid } : {}) },
        body: JSON.stringify({ products: names, items: detailedItems }),
      });

      if (!res.ok) throw new Error(`Ошибка сервера (${res.status})`);
      const json = await res.json();

      const withLead: RecipeWithLead[] = (json.recipes ?? []).map((r: RecipeDto, i: number) => ({
        ...r,
        lead: json?.trace?.leads?.[i] ?? undefined,
      }));
      const enriched = { ...json, recipes: withLead };

      try {
        localStorage.setItem(key, JSON.stringify(enriched));
      } catch {}
      sessionStorage.setItem("recipes_payload", JSON.stringify({ products: names, data: enriched }));

      router.replace(`/recipes?items=${encodeURIComponent(names.join(","))}`);
    } catch (e) {
      console.error(e);
      alert("Не удалось получить рецепты. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

// ... импорт/типы оставь как есть выше
// замени return на этот (остальной код файла – без изменений)

return (
  <section className="p-6 max-w-md mx-auto space-y-4">
    {/* Заголовок */}
    <h2 className="text-2xl font-extrabold tracking-tight text-[#1e1e1e]">
      Уточни список продуктов
    </h2>


    {/* Список продуктов */}
    {items.length > 0 && (
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li
            key={`${it.name}-${i}`}
            className="rounded-2xl border bg-white shadow-sm p-3 space-y-3"
          >
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm text-[#1e1e1e] placeholder:text-[#777] focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={it.name}
                onChange={(e) => updateItem(i, { name: e.target.value })}
              />
              <button
                type="button"
                onClick={() => handleRemove(it.name)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
                aria-label="Удалить"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Уточнение количества */}
            <button
              type="button"
              onClick={() => toggleDetailed(i)}
              aria-expanded={!!it.detailed}
              className="flex w-full items-center gap-2 text-[15px] font-semibold text-gray-900"
            >
              <svg
                className={`transition-transform ${it.detailed ? "rotate-180" : ""}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6b7280"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              Уточнить количество
            </button>

            {it.detailed && (
              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <input
                  type="number"
                  min={1}
                  step={it.unit === "pcs" ? 1 : 50}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1e1e1e] placeholder:text-[#777] focus:outline-none focus:ring-2 focus:ring-gray-300"
                  value={it.qty === undefined ? "" : it.qty}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      updateItem(i, { qty: undefined });
                      return;
                    }
                    const num = Number(v);
                    if (!Number.isNaN(num)) updateItem(i, { qty: num });
                  }}
                  onBlur={() => {
                    const current = items[i]?.qty;
                    let nextQty =
                      current === undefined ||
                      Number.isNaN(Number(current)) ||
                      Number(current) <= 0
                        ? 1
                        : Number(current);
                    if (items[i]?.unit === "pcs") {
                      nextQty = Math.max(1, Math.round(nextQty));
                    }
                    if (nextQty !== current) updateItem(i, { qty: nextQty });
                  }}
                  inputMode="numeric"
                  placeholder="0"
                />

                <div className="seg">
                  {(["g", "ml", "pcs"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className="seg-btn"
                      aria-pressed={(it.unit ?? defaultUnitFor(it.name)) === u}
                      onClick={() => updateItem(i, { unit: u })}
                    >
                      {u === "g" ? "г" : u === "ml" ? "мл" : "шт"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    )}

    {/* Добавление продукта */}
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={onNameKeyDown}
          placeholder="Например: огурец"
          className="w-full rounded-xl border bg-white px-4 py-3 text-sm text-[#1e1e1e] placeholder:text-[#777]"
          autoComplete="off"
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!nameInput.trim()}
        className="btn-soft shrink-0 whitespace-nowrap rounded-2xl px-6 py-3 text-[15px] font-semibold text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="inline-flex items-center gap-2">
          <span className="text-xl leading-none">+</span> Добавить
        </span>
      </button>
    </div>

    {/* Кнопки действий */}
    <div className="flex gap-3">
      <button
        type="button"
        onClick={handleClearAll}
        className="btn-soft rounded-2xl px-6 py-3 text-[15px] font-semibold text-gray-900"
      >
        <span className="inline-flex items-center gap-2">
          <span className="text-base leading-none">✕</span> Очистить
        </span>
      </button>

      {!hideAction && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={items.length === 0 || submitting}
          className="btn-peach w-full rounded-[28px] px-6 py-3.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
          aria-busy={submitting}
        >
          {submitting ? "Генерируем рецепты…" : "Показать рецепты"}
        </button>
      )}
    </div>
  </section>
);

}
