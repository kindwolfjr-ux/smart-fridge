// src/lib/analytics-init.ts
"use client";

import { Analytics } from "@/lib/analytics";

export async function initSession() {
  // твой существующий код установки cookie uid + localStorage sf_session_id остаётся тут
  // ...

  // восстановим согласие из localStorage
  Analytics.restore();

  // мини-логгер
  Analytics.setLogger((...args) => {
    console.groupCollapsed("%c[analytics]", "font-weight:bold");
    console.log(...args);
    console.groupEnd();
  });
}

// вызвать ПОСЛЕ клика "Согласен" в модалке
export function onConsentGranted() {
  Analytics.enable();
  Analytics.track("app_open");
}

// при старте: если согласие уже было, шлём app_open
export function autoAppOpenIfEnabled() {
  if (Analytics.isEnabled()) {
    Analytics.track("app_open");
  }
}
