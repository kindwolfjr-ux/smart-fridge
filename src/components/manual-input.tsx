// src/components/manual-input.tsx
"use client";

import { useRef, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import type { ProductQty } from "@/types/product";
import { track } from "@/lib/analytics";

type Props = {
  // старый режим совместимости (если кто-то ещё ждёт строку)
  onAdd?: (name: string) => void;
  // новый режим — предпочтительно использовать
  onAddQty?: (item: ProductQty) => void;
  autoFocusName?: boolean;
};

export default function ManualInput({ onAdd, onAddQty, autoFocusName }: Props) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const trackedRef = useRef(false); // чтобы не слать событие много раз

  const canAdd =
    name.trim().length > 0 &&
    qty !== "" &&
    Number(qty) > 0 &&
    Number.isFinite(Number(qty));

  const commit = () => {
    if (!canAdd) return;
    // ✅ аналитика: первое использование ручного ввода
    if (!trackedRef.current) {
      try { track("manual_input_used", {}); } catch {}
      trackedRef.current = true;
      }
    const item: ProductQty = { name: name.trim(), qty: Number(qty) };
    // предпочтительно отдаем новый формат
    onAddQty?.(item);
    // для обратной совместимости — вызываем старый, если есть
    onAdd?.(item.name);
    // очистка
    setName("");
    setQty("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
  };

  return (
    <div className="grid grid-cols-12 gap-3 items-end">
      <div className="col-span-7">
        <Label htmlFor="mi-name">Название</Label>
        <Input
          id="mi-name"
          placeholder="Например: огурец"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocusName}
        />
      </div>
      <div className="col-span-3">
        <Label htmlFor="mi-qty">Количество</Label>
        <Input
          id="mi-qty"
          type="number"
          min={1}
          step={1}
          placeholder="1"
          value={qty}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") setQty("");
            else setQty(Number(v));
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="col-span-2">
        <Button className="w-full" onClick={commit} disabled={!canAdd}>
          Добавить
        </Button>
      </div>
    </div>
  );
}
