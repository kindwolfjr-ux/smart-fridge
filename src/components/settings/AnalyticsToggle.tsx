"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@/lib/analytics";

const CONSENT_KEY = "sf_analytics";

export default function AnalyticsToggle() {
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CONSENT_KEY);
      setEnabled(v === "on");
    } catch {}
    setHydrated(true);
  }, []);

  const onChange = (next: boolean) => {
    setEnabled(next);
    if (next) {
      Analytics.enable();
      Analytics.track("app_open"); // отметим визит
    } else {
      Analytics.disable();
    }
  };

  if (!hydrated) return null;

  return (
    <div className="flex items-center justify-between rounded-2xl border p-4">
      <div>
        <div className="font-medium">Аналитика</div>
        <div className="text-sm text-gray-600">
          Собирать обезличенную статистику (открытия, загрузка фото, ручной ввод, запросы рецептов).
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
          enabled ? "bg-black" : "bg-gray-300",
        ].join(" ")}
        title={enabled ? "Выключить аналитику" : "Включить аналитику"}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            enabled ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
