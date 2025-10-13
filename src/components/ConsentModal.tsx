"use client";

import { useEffect, useRef, useState } from "react";
import { onConsentGranted } from "@/lib/analytics-init"; // 👈 импортируем централизованную функцию
import { Analytics } from "@/lib/analytics";

const CONSENT_KEY = "sf_analytics"; // ключ должен совпадать с Analytics

export default function ConsentModal() {
  const [open, setOpen] = useState(false);
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

  // Проверяем, было ли согласие ранее
  useEffect(() => {
    try {
      const v = localStorage.getItem(CONSENT_KEY);
      if (v === "on") {
        Analytics.enable(); // пользователь уже соглашался
        return;
      }
      if (v === null) setOpen(true); // первый запуск — спросим
    } catch {
      // если localStorage недоступен, просто не показываем
    }
  }, []);

  // Фокус на кнопку и закрытие по Esc
  useEffect(() => {
    if (!open) return;
    firstBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const onAgree = () => {
    onConsentGranted(); // 👈 включает аналитику и отправляет app_open
    setOpen(false);
  };

  const onDecline = () => {
    Analytics.disable();
    setOpen(false);
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onMouseDown={onBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="p-6 space-y-4">
          <h2 id="consent-title" className="text-lg font-semibold">
            Поможете улучшить приложение?
          </h2>
          <p id="consent-desc" className="text-sm text-gray-600">
            Мы собираем <span className="font-medium">обезличенную</span> статистику: открытия,
            загрузку фото, использование ручного ввода, запросы рецептов и расход токенов.
            Без текстов и без IP. Можно отключить в любой момент в настройках.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 h-10 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onDecline}
            >
              Не сейчас
            </button>
            <button
              type="button"
              ref={firstBtnRef}
              className="px-4 h-10 rounded-xl bg-black text-white hover:opacity-90"
              onClick={onAgree}
            >
              Разрешить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
