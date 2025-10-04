"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/ui/upload-zone";
import ManualInput from "@/components/manual-input";
import { Progress } from "@/components/ui/progress";

export default function HomeClient() {
  const router = useRouter();

  // Можно оставить индикатор для других действий на главной (не обязателен)
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loading) {
      setProgress(10);
      timerRef.current = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 8 : p));
      }, 150);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      const t = setTimeout(() => setProgress(0), 300);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Ручной ввод: переходим на экран подтверждения
  async function handleManualSubmit(text: string) {
    const items = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (items.length === 0) return;

    // Можно положить и в sessionStorage, но confirm уже умеет читать ?items
    const query = encodeURIComponent(items.join(","));
    router.push(`/confirm?items=${query}`);

    // (необязательно) метрика ручного сабмита
    fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: "manual_submit",
        count_total: items.length,
        count_selected: items.length,
      }),
    }).catch(() => {});
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
          Что приготовить?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Загрузите фото или введите продукты вручную — покажем 3 идеи.
        </p>

        <div className="mt-8 space-y-6">
          {/* Фото: компонент сам вызывает /api/scan и перекидывает на /confirm */}
          <UploadZone />

          {/* Ручной ввод: уходит на /confirm?items=... */}
          <ManualInput onSubmit={handleManualSubmit} />
        </div>

        {loading && (
          <div className="mt-8">
            <Progress value={progress} />
            <p className="mt-2 text-sm text-muted-foreground">Обрабатываем…</p>
          </div>
        )}
      </section>
    </main>
  );
}
