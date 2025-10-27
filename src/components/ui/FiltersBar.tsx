// app/components/ui/FiltersBar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type FiltersState = {
  vegan: boolean;
  halal: boolean;
  noPork: boolean;
  noSugar: boolean;
};

const LS_KEY = "hb_filters_v1";

function readFromLocalStorage(): Partial<FiltersState> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeToLocalStorage(state: FiltersState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

function boolFromQuery(v: string | null): boolean {
  return v === "1" || v === "true";
}

function toQueryValue(b: boolean): string | null {
  return b ? "1" : null;
}

export default function FiltersBar() {
  const router = useRouter();
  const sp = useSearchParams();

  // начальное состояние: URL → localStorage → default false
  const initial: FiltersState = useMemo(() => {
    const fromUrl: Partial<FiltersState> = {
      vegan: boolFromQuery(sp.get("vegan")),
      halal: boolFromQuery(sp.get("halal")),
      noPork: boolFromQuery(sp.get("noPork")),
      noSugar: boolFromQuery(sp.get("noSugar")),
    };
    const fromLs = typeof window !== "undefined" ? readFromLocalStorage() : {};
    return {
      vegan: fromUrl.vegan ?? fromLs.vegan ?? false,
      halal: fromUrl.halal ?? fromLs.halal ?? false,
      noPork: fromUrl.noPork ?? fromLs.noPork ?? false,
      noSugar: fromUrl.noSugar ?? fromLs.noSugar ?? false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // важно: только один раз на маунт

  const [filters, setFilters] = useState<FiltersState>(initial);

  // при изменении — пишем в localStorage и обновляем URL (не теряя остальные query-параметры)
  useEffect(() => {
    writeToLocalStorage(filters);

    const params = new URLSearchParams(Array.from(sp.entries())); // копия текущих
    const map: Array<[keyof FiltersState, string]> = [
      ["vegan", "vegan"],
      ["halal", "halal"],
      ["noPork", "noPork"],
      ["noSugar", "noSugar"],
    ];

    for (const [k, q] of map) {
      const v = toQueryValue(filters[k]);
      if (v) params.set(q, v);
      else params.delete(q);
    }

    // Обновляем URL без перезагрузки
    const qs = params.toString();
    const href = qs ? `?${qs}` : "?";
    router.replace(href, { scroll: false });
  }, [filters, router, sp]);

  const toggle = (key: keyof FiltersState) =>
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="glass-card rounded-2xl p-3 text-left">
      <p className="text-sm mb-2 opacity-70">Фильтры питания</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.vegan}
            onChange={() => toggle("vegan")}
          />
          <span className="text-sm">Vegan</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.halal}
            onChange={() => toggle("halal")}
          />
          <span className="text-sm">Halal</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.noPork}
            onChange={() => toggle("noPork")}
          />
          <span className="text-sm">No Pork</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.noSugar}
            onChange={() => toggle("noSugar")}
          />
          <span className="text-sm">No Sugar</span>
        </label>
      </div>
    </div>
  );
}
