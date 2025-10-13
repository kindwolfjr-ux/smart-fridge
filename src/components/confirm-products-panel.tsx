"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeDto } from "@/types/recipe";
import { track, getSessionId } from "@/lib/analytics";

type Unit = "g" | "ml" | "pcs";
type ProductQty = {
  name: string;
  detailed?: boolean;   // пользователь включил "уточнить"
  qty?: number;         // только если detailed = true
  unit?: Unit;          // только если detailed = true
};

type ConfirmProductsPanelProps = {
  initialItems?: string[];              // как раньше
  onClear?: () => void;
  onChange?: (items: string[]) => void; // совместимость по именам
  hideAction?: boolean;
  onChangeQty?: (items: ProductQty[]) => void; // новый полный формат
};

type RecipeWithLead = RecipeDto & { lead?: string };

const norm = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, " ").replace(/ё/g, "е");

// простая эвристика по единицам
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
  const [qtyInput, setQtyInput] = useState<number | "">(""); // можно оставить, если пригодится позже
  const [submitting, setSubmitting] = useState(false);

  const lastEmittedRef = useRef<string>("");

  const emitChange = (next: ProductQty[]) => {
    const key = next
      .map((i) =>
        i.detailed
          ? `${norm(i.name)}:${i.qty ?? ""}${i.unit ?? ""}`
          : `${norm(i.name)}`
      )
      .join("|");
    if (key === lastEmittedRef.current) return;
    lastEmittedRef.current = key;

    onChange?.(next.map((i) => i.name));
    onChangeQty?.(next);
  };

  // старт: строки -> ProductQty с detailed=false
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

  // 🔧 фикс мигалок: гидратим только один раз (или если пришёл новый набор и локальный список пуст)
  const initialKeyRef = useRef<string>("");
  const initialKey = useMemo(
    () =>
      (initialItems ?? [])
        .map((x) => norm(String(x)))
        .filter(Boolean)
        .sort()
        .join("|"),
    [initialItems]
  );

  useEffect(() => {
    const currentNamesKey = items.map((i) => norm(i.name)).sort().join("|");

    // первый заход — гидратация
    if (!initialKeyRef.current) {
      setItems(normalizedInitial);
      lastEmittedRef.current = normalizedInitial
        .map((i) => `${norm(i.name)}${i.detailed ? `:${i.qty}${i.unit}` : ""}`)
        .join("|");
      initialKeyRef.current = initialKey;
      return;
    }

    // если пришёл ДРУГОЙ набор initialItems и локальный список пока пуст — тоже гидратация
    if (initialKey !== initialKeyRef.current && items.length === 0 && currentNamesKey === "") {
      setItems(normalizedInitial);
      lastEmittedRef.current = normalizedInitial
        .map((i) => `${norm(i.name)}${i.detailed ? `:${i.qty}${i.unit}` : ""}`)
        .join("|");
      initialKeyRef.current = initialKey;
      return;
    }

    // иначе ничего не делаем — не перетираем локальные правки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, normalizedInitial]); // намеренно без items в deps

  // === добавление ===
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

  // === редактирование строки ===
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

  // === кэш-ключ: учитываем qty/unit ТОЛЬКО для detailed ===
  const makeCacheKey = (arr: ProductQty[]) => {
    const mapped = arr.map((i) => ({
      n: norm(i.name),
      d: !!i.detailed,
      q: i.detailed ? Math.max(1, Number(i.qty) || 1) : undefined,
      u: i.detailed ? i.unit : undefined,
    }));
    mapped.sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
    return (
      "recipes:" +
      mapped
        .map((i) => (i.d ? `${i.n}:${i.q}${i.u}` : i.n))
        .join("|")
    );
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
  .filter((i) => i.detailed && i.unit) // qty может быть пустым — нормализуем ниже
  .map((i) => {
    let q = Number(i.qty);
    if (!Number.isFinite(q) || q <= 0) q = 1;
    if (i.unit === "pcs") q = Math.max(1, Math.round(q));
    return { name: i.name.trim(), qty: q, unit: i.unit as Unit };
  });

    try {
      // 0) client-cache
      try {
        const cachedRaw = localStorage.getItem(key);
        if (cachedRaw) {
          const enriched = JSON.parse(cachedRaw);
          sessionStorage.setItem(
            "recipes_payload",
            JSON.stringify({ products: names, data: enriched })
          );
          router.replace(`/recipes?items=${encodeURIComponent(names.join(","))}`);
          return;
        }
      } catch {}

      // 1) запрос
      sessionStorage.removeItem("recipes_payload");
       // ✅ аналитика: пользователь запросил рецепты
       try { track("recipes_requested", {}); } catch {}
       // прокинем sessionId в заголовок — серверу для token_spent
       const sid = getSessionId?.();

      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sid ? { "x-session-id": sid } : {}),
          },
        body: JSON.stringify({
          products: names,       // как раньше — список имён
          items: detailedItems,  // НОВОЕ: только уточнённые позиции
        }),
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

      // 3) client-cache и session
      try {
        localStorage.setItem(key, JSON.stringify(enriched));
      } catch {}
      sessionStorage.setItem(
        "recipes_payload",
        JSON.stringify({ products: names, data: enriched })
      );

      router.replace(`/recipes?items=${encodeURIComponent(names.join(","))}`);
    } catch (e) {
      console.error(e);
      alert("Не удалось получить рецепты. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="p-6 max-w-md mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Подтвердите список продуктов</h2>
      <p className="text-sm text-gray-500">
        Добавьте продукты вручную или отсканируйте холодильник.
      </p>

      {/* Список с тумблером «Уточнить» */}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  value={it.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => handleRemove(it.name)}
                  className="text-red-500 text-xs hover:underline whitespace-nowrap"
                >
                  удалить
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!it.detailed}
                    onChange={() => toggleDetailed(i)}
                  />
                  Уточнить количество
                </label>

                {it.detailed && (
                  <>
                    <input
  type="number"
  min={1}
  step={it.unit === "pcs" ? 1 : 50}
  className="w-24 border rounded px-2 py-1 text-sm"
  value={it.qty === undefined ? "" : it.qty}   // ← даём стереть значение
  onChange={(e) => {
    const v = e.target.value;
    if (v === "") {
      // временно пусто — не навязываем 1
      updateItem(i, { qty: undefined });
      return;
    }
    // если вводят число — не форсим границы здесь
    const num = Number(v);
    if (!Number.isNaN(num)) {
      updateItem(i, { qty: num });
    }
  }}
  onBlur={() => {
    // при уходе с поля нормализуем
    const current = items[i]?.qty;
    let nextQty =
      current === undefined || Number.isNaN(Number(current)) || Number(current) <= 0
        ? 1
        : Number(current);

    // для штук — целое
    if (items[i]?.unit === "pcs") {
      nextQty = Math.round(nextQty);
      if (nextQty < 1) nextQty = 1;
    }

    if (nextQty !== current) {
      updateItem(i, { qty: nextQty });
    }
  }}
  inputMode="numeric"
/>

                    <select
                      className="w-24 border rounded px-2 py-1 textсм"
                      value={it.unit ?? defaultUnitFor(it.name)}
                      onChange={(e) =>
                        updateItem(i, { unit: e.target.value as Unit })
                      }
                    >
                      <option value="g">г</option>
                      <option value="ml">мл</option>
                      <option value="pcs">шт</option>
                    </select>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Ряд добавления */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={onNameKeyDown}
            placeholder="Например: огурец"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!nameInput.trim()}
          className="shrink-0 whitespace-nowrap rounded-lg bg-black text-white px-4 py-2 text-sm hover:bg-black/90 disabled:opacity-40 disabled:cursor-not-allowed"
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

        {!hideAction && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={items.length === 0 || submitting}
            className="flex-1 rounded-xl bg-green-600 text-white py-3 font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-busy={submitting}
          >
            {submitting ? "Генерируем рецепты…" : "Показать рецепт"}
          </button>
        )}
      </div>
    </section>
  );
}
