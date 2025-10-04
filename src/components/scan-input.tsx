"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanInput() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // читаем в base64
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

    try {
      setLoading(true);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64 }),
      });

      const data = await res.json();

      if (!data?.ok || !Array.isArray(data.products) || data.products.length === 0) {
        alert("Не удалось распознать продукты. Добавьте вручную.");
        return;
      }

      // сбрасываем старые рецепты и переходим на /confirm с продуктами
      sessionStorage.removeItem("recipes_payload");
      const itemsParam = encodeURIComponent(data.products.join(","));
      router.push(`/confirm?items=${itemsParam}`);
    } catch (err) {
      console.error("scan ui error:", err);
      alert("Ошибка при сканировании. Попробуйте другое фото.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">📸 Отправить фото холодильника</label>
      <input
        type="file"
        accept="image/*"
        onChange={onFileChange}
        disabled={loading}
        className="block w-full text-sm"
      />
      {loading && <p className="text-xs text-gray-500">Распознаём продукты…</p>}
    </div>
  );
}
