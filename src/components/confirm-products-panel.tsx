"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";


type Unit = "g" | "ml" | "pcs";
export type ProductQty = { name: string; detailed?: boolean; qty?: number; unit?: Unit };

type ConfirmProductsPanelProps = {
  initialItems?: string[];
  onClear?: () => void;
  onChange?: (items: string[]) => void;
  hideAction?: boolean;
  onChangeQty?: (items: ProductQty[]) => void;
};

const norm = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, " ").replace(/ё/g, "е");

const defaultUnitFor = (name: string): Unit => {
  const n = norm(name);
  const isLiquid = /(молок|сливк|вода|соус|масло|йогурт|кефир|бульон|сок|напит)/.test(n);
  const isPiece =
    /(огурц|помидор|яйц|лук|яблок|банан|перец|томат|зубчик|булоч|батон)/.test(n);
  if (isLiquid) return "ml";
  if (isPiece) return "pcs";
  return "g";
};

export default function ConfirmProductsPanel({
  initialItems = [],
  onClear,
  onChange,
  onChangeQty,
  hideAction = true,
}: ConfirmProductsPanelProps) {
  const [items, setItems] = useState<ProductQty[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [qtyInput, setQtyInput] = useState<string>("");
  const [unitInput, setUnitInput] = useState<Unit>("pcs");

  // ── анимация раскрытия блока количества
  const detailsRef = useRef<HTMLDivElement>(null);
  const [detailsHeight, setDetailsHeight] = useState(0);
  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    setDetailsHeight(showDetails ? el.scrollHeight : 0);
  }, [showDetails, qtyInput, unitInput]);

  // ── init из initialItems
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
    () =>
      (initialItems ?? [])
        .map((x) => norm(String(x)))
        .filter(Boolean)
        .sort()
        .join("|"),
    [initialItems]
  );

  useEffect(() => {
    if (!initialKeyRef.current) {
      setItems(normalizedInitial);
      initialKeyRef.current = initialKey;
    } else if (initialKey !== initialKeyRef.current && items.length === 0) {
      setItems(normalizedInitial);
      initialKeyRef.current = initialKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, normalizedInitial]);

  // ── эмит наверх
  const lastSig = useRef("");
  const emit = (next: ProductQty[]) => {
    const sig = next
      .map((i) =>
        i.detailed
          ? `${norm(i.name)}:${i.qty ?? ""}${i.unit ?? ""}`
          : norm(i.name)
      )
      .join("|");
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    onChange?.(next.map((i) => i.name));
    onChangeQty?.(next);
  };

  // ── добавление
  const canAdd = nameInput.trim().length > 0;

  const commitItem = () => {
  if (!canAdd) return;

  const name = nameInput.trim();
  const key = norm(name);

  // если такой продукт уже есть — обновляем его количеством/единицей
  const existsIdx = items.findIndex((i) => norm(i.name) === key);
  if (existsIdx >= 0) {
    const next = [...items];

    if (showDetails && qtyInput.trim() !== "") {
      let q = Number(qtyInput.replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) q = 1;
      const u: Unit = unitInput ?? defaultUnitFor(name);
      if (u === "pcs") q = Math.max(1, Math.round(q));

      next[existsIdx] = { ...next[existsIdx], detailed: true, qty: q, unit: u };
    } else {
      // без количества просто убедимся, что detailed=false
      next[existsIdx] = { ...next[existsIdx], detailed: false, qty: undefined, unit: undefined };
    }

    setItems(next);
    emit(next);

    // reset
    setNameInput("");
    setQtyInput("");
    setShowDetails(false);
    setUnitInput(defaultUnitFor(name));
    return;
  }

  // иначе добавляем новый элемент (как и раньше)
  let nextItem: ProductQty = { name, detailed: false };
  if (showDetails && qtyInput.trim() !== "") {
    let q = Number(qtyInput.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) q = 1;
    const u: Unit = unitInput ?? defaultUnitFor(name);
    if (u === "pcs") q = Math.max(1, Math.round(q));
    nextItem = { name, detailed: true, qty: q, unit: u };
  }

  const next = [...items, nextItem];
  setItems(next);
  emit(next);

  // reset
  setNameInput("");
  setQtyInput("");
  setShowDetails(false);
  setUnitInput(defaultUnitFor(name));
  };

  // Обновить существующий тег по текущим вводам qty/unit
  const applyDetailsToExisting = () => {
  if (!showDetails) return;
  const name = nameInput.trim();
  if (!name) return;

  const idx = items.findIndex((i) => norm(i.name) === norm(name));
  if (idx < 0) return;

  const v = qtyInput.trim();
  if (!v) return; // не трогаем, если количества нет

  let q = Number(v.replace(",", "."));
  if (!Number.isFinite(q) || q <= 0) q = 1;

  const u: Unit = unitInput ?? defaultUnitFor(name);
  if (u === "pcs") q = Math.max(1, Math.round(q));

  const next = [...items];
  next[idx] = { ...next[idx], detailed: true, qty: q, unit: u };
  setItems(next);
  emit(next);
  };

  useEffect(() => {
  applyDetailsToExisting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [qtyInput, unitInput]);




  const onNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitItem();
    }
  };

  const removeAt = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    emit(next);
  };

  const clearAll = () => {
    setItems([]);
    emit([]);
    onClear?.();
  };

  // ── токены стилей
  const inputBase =
    "h-12 rounded-[18px] sm:rounded-[20px] border border-gray-300 bg-white px-4 " +
    "text-[16px] leading-none text-[#1e1e1e] placeholder:text-gray-400 " +
    "focus:outline-none focus:ring-2 focus:ring-gray-300";

  const neutralBtn =
    "rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <section className="p-6 w-full space-y-4">
      <h2 className="whitespace-nowrap text-[20px] sm:text-2xl font-extrabold tracking-tight text-[#1e1e1e] leading-tight">
        Уточни список продуктов
      </h2>

{/* ░░ ЗОНА ВВОДА (full-bleed на мобиле) ░░ */}
<div className="-mx-6 sm:mx-0">
  <div className="w-full rounded-[36px] sm:rounded-[48px] border border-gray-200 bg-white/90 shadow-sm px-3 py-3 sm:px-6 sm:py-5">

    {/* Ряд 1: название + «+» */}
    <div className="grid grid-cols-[1fr_auto] items-center gap-2.5 sm:gap-4">
      <input
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        onKeyDown={onNameKeyDown}
        placeholder="Например: огурец"
        className={`${inputBase} min-w-0`}  // ← разрешаем сжатие
        autoComplete="off"
      />
      <button
        type="button"
        onClick={commitItem}
        disabled={!canAdd}
        aria-label="Добавить"
        className={`${neutralBtn} h-12 w-12 flex items-center justify-center shrink-0`} // ← не даём кнопке сжиматься
      >
        <Plus className="h-5 w-5 text-gray-800" />
      </button>
    </div>

    {/* Триггер количества */}
{!showDetails && (
  <div className="mt-2 flex justify-center">
    <button
      type="button"
      onClick={() => setShowDetails(true)}
      aria-expanded={false}
      className="inline-flex items-center gap-1.5 text-[15px] font-medium text-gray-500 hover:text-gray-700"
    >
      <span>количество</span>
      <ChevronDown className="h-4 w-4 translate-y-[1px]" aria-hidden />
    </button>
  </div>
)}




    {/* Анимированный блок количества — ВНУТРИ карточки */}
    <div
      className={`overflow-hidden transition-[height] duration-300 ease-out ${showDetails ? "mt-2" : "mt-0"}`}
      style={{ height: detailsHeight }}
    >
      <div
        ref={detailsRef}
        className={`grid items-center gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-[1fr_128px] transition-opacity duration-300 ${showDetails ? "opacity-100" : "opacity-0"}`}
      >
        <input
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value.replace(/[^\d.,]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && commitItem()}
          inputMode="decimal"
          placeholder="кол-во"
          className={`${inputBase} min-w-0`}
        />

        {/* Select: на мобиле занимает 50%, фикс ширина только с sm: */}
        <div className="relative w-full sm:w-[128px] shrink-0">
          <select
            value={unitInput}
            onChange={(e) => setUnitInput(e.target.value as Unit)}
            className={`${inputBase} w-full pr-8 appearance-none text-center`}
          >
            <option value="pcs">шт</option>
            <option value="g">г</option>
            <option value="ml">мл</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            aria-hidden="true"
          />
        </div>

<div className="col-span-2">
  <div className="mt-2 flex justify-center">
    <button
      type="button"
      onClick={() => { applyDetailsToExisting(); setShowDetails(false); }}
      aria-expanded={true}
      className="inline-flex items-center gap-1.5 text-[15px] font-medium text-gray-500 hover:text-gray-700"
    >
      <span>скрыть</span>
      <ChevronUp className="h-4 w-4 translate-y-[1px]" aria-hidden />
    </button>
  </div>
</div>




      </div>
    </div>
  </div>
</div>

      {/* ░░ Список продуктов ░░ */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span
            key={`${it.name}-${i}`}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            <span className="text-gray-900 truncate max-w-[70vw] sm:max-w-none">
              {it.name}
              {it.detailed && it.qty
                ? ` ${
                    it.unit === "pcs" ? Math.round(it.qty) : it.qty
                  } ${it.unit === "pcs" ? "шт" : it.unit}`
                : ""}
            </span>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="rounded-full px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Удалить"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Если нужна кнопка очистки внутри панели — верни clearAll сюда. */}
      {/* {!hideAction && ... } */}
    </section>
  );
}
