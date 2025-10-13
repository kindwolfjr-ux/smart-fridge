"use client";

// минимальный клиентский трекер
export type EventName =
  | "app_open"
  | "photo_uploaded"
  | "manual_input_used"
  | "recipes_requested"
  | "token_spent"; // на клиенте не будем вызывать, это серверное — просто для типизации

let sessionId: string | null = null;
let enabled = false;

export function isAnalyticsEnabled() {
  return enabled;
}

export function initSession() {
  // вызывать ОДИН раз после согласия
  if (enabled && !sessionId) {
    sessionId = crypto.randomUUID();
    // событие открытия приложения
    track("app_open", {});
  }
}

export async function track(name: EventName, payload: Record<string, any>) {
  // ничего не шлём без согласия или без сессии
  if (!enabled || !sessionId) return;
  try {
    await fetch("/api/analytics/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        payload,
        sessionId,
        ts: new Date().toISOString(),
      }),
      keepalive: true, // чтобы не терять событие при закрытии вкладки
    });
  } catch {
    // молча проглатываем — аналитика не должна ломать UX
  }
}

export function enableAnalyticsAndStart() {
  enabled = true;
  localStorage.setItem("analytics_enabled", "1");
  if (!sessionId) initSession();
}

export function disableAnalytics() {
  enabled = false;
  localStorage.setItem("analytics_enabled", "0");
}

export function getSessionId() {
  return sessionId;
}