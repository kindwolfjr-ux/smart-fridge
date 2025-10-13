'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { track } from "@/lib/analytics";

// ── Types ──────────────────────────────────────────────────────────────
type Item = { id: string; name: string; checked: boolean };

// ── Helpers ────────────────────────────────────────────────────────────
function normalizeName(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,;:!?]/g, '').replace(/ё/g, 'е');
}
function makeId(name: string) {
  return `${normalizeName(name)}-${Math.random().toString(36).slice(2, 8)}`;
}
function uniqNames(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of arr) {
    const k = normalizeName(n);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(n.trim());
  }
  return out;
}
function computeCacheKey(names: string[]) {
  return uniqNames(names).map(normalizeName).sort().join('|');
}

// ── Component ──────────────────────────────────────────────────────────
type Props = { initial?: string[] };

export default function ConfirmList({ initial = [] }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  // 👉 аналитика: панель ручного ввода открыта
  useEffect(() => {
    track("manual_input_used", { action: "open" });
  }, []);

  // ?items=... из URL — мемоизируем, чтобы deps эффекта были простыми
  const itemsFromQuery = useMemo<string[]>(() => {
    const q = search.get('items');
    if (!q) return [];
    return uniqNames(q.split(',').map(s => s.trim()));
  }, [search]);

  // 1) Гидратация списка (по приоритетам: initial → query → sessionStorage → пусто)
  useEffect(() => {
    setLoading(true);
    try {
      if (initial.length) {
        const list = uniqNames(initial);
        setItems(list.map(n => ({ id: makeId(n), name: n, checked: true })));
        return;
      }
      if (itemsFromQuery.length) {
        setItems(itemsFromQuery.map(n => ({ id: makeId(n), name: n, checked: true })));
        return;
      }
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem('lastScanItems') : null;
      if (stored) {
        const list = uniqNames(JSON.parse(stored) as string[]);
        setItems(list.map(n => ({ id: makeId(n), name: n, checked: true })));
        return;
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [initial, itemsFromQuery]);

  const anyChecked = items.some(i => i.checked);
  const selectedNames = useMemo(() => items.filter(i => i.checked).map(i => i.name), [items]);
  const cacheKey = useMemo(() => computeCacheKey(selectedNames), [selectedNames]);

  // ── Actions ──────────────────────────────────────────────────────────
  function addItem() {
    const v = input.trim();
    if (!v) return;
    setItems(prev => {
      const names = uniqNames([...prev.map(p => p.name), v]);
      const m = new Map(names.map(n => [normalizeName(n), n]));
      const merged: Item[] = [];
      for (const it of prev) {
        if (m.has(normalizeName(it.name))) merged.push({ ...it, checked: true });
      }
      if (!prev.some(p => normalizeName(p.name) === normalizeName(v))) {
        merged.push({ id: makeId(v), name: v, checked: true });
      }
      return merged;
    });
    setInput('');
  }

  function toggle(id: string) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }

  function removeId(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function toggleAll(next: boolean) {
    setItems(prev => prev.map(i => ({ ...i, checked: next })));
  }

  async function sendMetrics(stage: string, payload: Record<string, unknown>) {
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, ...payload }),
      });
    } catch {
      // не мешаем UX, если метрики упали
    }
  }

  // Получить рецепты и перейти на /recipes (с сохранением payload в sessionStorage)
  async function onConfirm() {
    if (!anyChecked) return;
    const products = selectedNames;

    // 👉 аналитика: сабмит ручного ввода
    try {
      track("manual_input_used", { action: "submit", itemsCount: products.length });
      // 👉 аналитика: запрос рецептов
      track("recipes_requested", { mode: "default", productsCount: products.length });
    } catch {}

    // метрики (не блокируют UX)
    void sendMetrics('confirm_list', {
      count_total: items.length,
      count_selected: products.length,
      cache_key: cacheKey,
    });

    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products, cacheKey }),
    });
    if (!res.ok) {
      alert('Ошибка при генерации рецептов');
      return;
    }

    const payload = await res.json();
    sessionStorage.setItem('recipes_payload', JSON.stringify(payload));

    // помечаем низкоприоритетный переход, чтобы задействовать isPending
    startTransition(() => {
      router.replace('/recipes');
    });
  }

  // ── UI ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Подтвердите список продуктов</h1>
        <div className="text-xs text-gray-500">
          выбрано: <span className="font-medium text-gray-900">{selectedNames.length}</span>
        </div>
      </div>

      {/* Добавить вручную */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2"
          placeholder="Добавить продукт..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
        />
        <button onClick={addItem} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
          Добавить
        </button>
      </div>

      {/* Панель действий */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => toggleAll(true)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
          Выбрать все
        </button>
        <button onClick={() => toggleAll(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
          Снять все
        </button>
        <button
          onClick={() => setItems(prev => prev.filter(i => i.checked))}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Удалить с отключенными галочками
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div className="rounded-xl border p-4 text-sm text-gray-600">Загружаем найденные продукты…</div>
      ) : (
        <ul className="space-y-2">
          {items.length === 0 ? (
            <li className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
              Список пуст. Добавьте продукты выше.
            </li>
          ) : (
            items.map(it => (
              <li key={it.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={it.checked}
                    onChange={() => toggle(it.id)}
                  />
                  <span className={it.checked ? '' : 'text-gray-500'}>{it.name}</span>
                </label>
                <button
                  onClick={() => removeId(it.id)}
                  className="rounded-lg border px-2 py-1 text-sm hover:bg-gray-50"
                >
                  Удалить
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <button
        onClick={onConfirm}
        disabled={isPending || !anyChecked}
        className="w-full rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Готовим…' : 'Подтвердить и получить рецепты'}
      </button>

      {/* тех.инфо для дебага */}
      {anyChecked && (
        <p className="text-[11px] text-gray-400" title={cacheKey}>
          cacheKey готов
        </p>
      )}
    </div>
  );
}
