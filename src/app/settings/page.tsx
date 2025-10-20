// src/app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ToggleSwitch from "@/components/ui/ToggleSwitch";

export default function SettingsPage() {
  const router = useRouter();
  const back = () => (history.length > 1 ? router.back() : router.push("/"));

  const [analytics, setAnalytics] = useState<boolean>(true);

  // загрузка из localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem("analytics_enabled");
      if (v !== null) setAnalytics(v === "1");
    } catch {}
  }, []);

  // сохранение
  useEffect(() => {
    try {
      localStorage.setItem("analytics_enabled", analytics ? "1" : "0");
    } catch {}
  }, [analytics]);

  return (
    <main className="p-6 mx-auto max-w-xl sm:max-w-2xl space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={back}
          className="rounded-2xl px-4 py-2 glass-card hover:shadow-md transition"
        >
          ← Назад
        </button>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <div className="w-[84px]" />
      </div>

      {/* Карточка: Аналитика */}
      <section
        className="glass-card rounded-3xl p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
        onClick={() => setAnalytics((v) => !v)} // клик по строке переключает
        role="button"
        aria-label="Переключить сбор обезличенной аналитики"
      >
        <div className="text-left">
          <div className="text-base font-semibold">Аналитика</div>
          <div className="text-sm text-slate-600">
            Собирать обезличенную статистику (открытия, загрузка фото, ручной ввод, запросы рецептов).
          </div>
        </div>

        <ToggleSwitch
          checked={analytics}
          onChange={setAnalytics}
          // чтобы клик по строке не срабатывал дважды
          className="pointer-events-auto"
        />
      </section>
    </main>
  );
}
