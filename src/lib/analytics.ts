// src/lib/analytics.ts
"use client";

type EventName =
  | "app_open"
  | "photo_uploaded"
  | "manual_input_used"
  | "recipes_requested"
  | "token_spent";

type Json = Record<string, unknown>;

const INGEST_URL = "/api/analytics/ingest";
const SESSION_KEY = "sf_session_id";
const CONSENT_KEY = "sf_analytics"; // <— используем один ключ везде
const DEBUG =
  typeof window !== "undefined" &&
  (location.hostname === "localhost" ||
    !!process.env.NEXT_PUBLIC_ANALYTICS_DEBUG);

let enabled = false;
let sending = false;
let queue: Array<{ name: EventName; payload?: Json; ts: number }> = [];
let devLogger: ((...args: any[]) => void) | null = null;

function log(...args: any[]) {
  if (!DEBUG) return;
  if (devLogger) devLogger(...args);
  else console.debug("[analytics]", ...args);
}

export function isAnalyticsEnabled() {
  return enabled;
}
export function enableAnalytics() {
  enabled = true;
  try {
    localStorage.setItem(CONSENT_KEY, "on");
  } catch {}
  flush();
}
export function disableAnalytics() {
  enabled = false;
  try {
    localStorage.setItem(CONSENT_KEY, "off");
  } catch {}
}
export function restoreAnalyticsFromStorage() {
  try {
    enabled = localStorage.getItem(CONSENT_KEY) === "on";
  } catch {
    enabled = false;
  }
}
export function setAnalyticsLogger(fn: ((...args: any[]) => void) | null) {
  devLogger = fn;
}

export async function track(name: EventName, payload?: Json) {
  if (!enabled) {
    log("skip (disabled):", name, payload);
    return;
  }
  const ts = Date.now();
  queue.push({ name, payload, ts });
  log("queued:", name, payload);
  if (!sending) flush();
}

async function flush() {
  if (sending || queue.length === 0) return;
  sending = true;

  const batch = queue.slice(0);
  const body = await buildBody(batch);

  const sendWithRetry = async () => {
    const maxAttempts = 3;
    let attempt = 0;
    let lastErr: unknown;
    const baseDelay = 300;

    while (attempt < maxAttempts) {
      try {
        const res = await fetch(INGEST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        });
        if (!res.ok) throw new Error(`ingest ${res.status}`);
        return;
      } catch (e) {
        lastErr = e;
        attempt += 1;
        const delay = baseDelay * Math.pow(3, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  };

  try {
    await sendWithRetry();
    queue.splice(0, batch.length);
    log("sent:", batch.map((e) => e.name));
  } catch (e) {
    log("send failed, keep queued:", e);
  } finally {
    sending = false;
    if (queue.length) flush();
  }
}

async function buildBody(batch: Array<{ name: EventName; payload?: Json; ts: number }>) {
  const session_id = safeLocalStorageGet(SESSION_KEY) || undefined;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
  const anon_user_id = readCookie("uid") || undefined;

  return {
    anon_user_id,
    session_id,
    ua,
    events: batch.map((e) => ({
      name: e.name,
      payload: e.payload ?? {},
      ts: e.ts,
    })),
  };
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function safeLocalStorageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// 👉 запрашивали это в компонентах
export function getSessionId(): string | null {
  return safeLocalStorageGet(SESSION_KEY);
}

// удобный namespace
export const Analytics = {
  track,
  enable: enableAnalytics,
  disable: disableAnalytics,
  restore: restoreAnalyticsFromStorage,
  setLogger: setAnalyticsLogger,
  isEnabled: isAnalyticsEnabled, // ← теперь можно вызывать Analytics.isEnabled()
  getSessionId,                  // ← и Analytics.getSessionId()
};

export type { EventName };
