"use client";

import { useEffect, useState } from "react";
import { enableAnalyticsAndStart, disableAnalytics, isAnalyticsEnabled } from "@/lib/analytics";

export default function ConsentModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("analytics_enabled");
    if (v === null) {
      // первый запуск — спросим согласие
      setOpen(true);
    } else if (v === "1" && !isAnalyticsEnabled()) {
      // пользователь уже согласился ранее — стартуем сессию
      enableAnalyticsAndStart();
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 grid place-items-center bg-black/40 p-4 z-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-semibold">Поможете улучшить приложение?</h2>
        <p className="text-sm text-gray-600">
          Мы собираем <b>обезличенную</b> статистику: открытия, загрузку фото,
          использование ручного ввода, запросы рецептов и расход токенов. Без текстов и без IP.
          Можно отключить в любой момент в настройках.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              disableAnalytics();
              setOpen(false);
            }}
            className="px-3 py-2 rounded border"
          >
            Не сейчас
          </button>
          <button
            onClick={() => {
              enableAnalyticsAndStart();
              setOpen(false);
            }}
            className="px-3 py-2 rounded bg-black text-white"
          >
            Согласен(на)
          </button>
        </div>
      </div>
    </div>
  );
}
