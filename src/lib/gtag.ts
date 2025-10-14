// src/lib/gtag.ts
export function trackGA(event: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", event, params || {});
  }
}
