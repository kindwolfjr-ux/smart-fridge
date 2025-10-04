// Базовые разрешенные "кухонные": можно расширять при необходимости
export const BASIC_ALLOWED = new Set(["соль", "перец", "масло", "вода"]);

// Синонимы → каноническое имя
const CANON_MAP: Record<string, string> = {
  "макароны": "паста",
  "спагетти": "паста",
  "пенне": "паста",
  "вермишель": "паста",
  "колбаска": "колбаса",
  "сосиска": "колбаса",
  "оливковое масло": "масло",
  "растительное масло": "масло",
  "подсолнечное масло": "масло",
  "перец черный": "перец",
  "черный перец": "перец",
  "вода питьевая": "вода",
};

export function canonicalize(raw: string): string {
  const s = raw.trim().toLowerCase();
  return CANON_MAP[s] ?? s;
}

export function canonicalizeList(items: string[]): string[] {
  const seen = new Set<string>();
  for (const x of items) {
    const c = canonicalize(x);
    if (c) seen.add(c);
  }
  return Array.from(seen);
}

// Нормализация единиц и количеств
type NormalizedUnit = "г" | "мл" | "ст. л." | "ч. л.";

export function normalizeUnit(name: string, unit?: string): NormalizedUnit {
  const n = name.toLowerCase();
  // Соль/масло — разумно разрешать "ложки"
  if (n === "соль" || n === "масло" || n === "перец") {
    if (unit === "ч. л.") return "ч. л.";
    if (unit === "ст. л.") return "ст. л.";
    // дефолт для соли/масла/перца — чайная ложка
    return n === "масло" ? "ст. л." : "ч. л.";
  }
  // Вода по умолчанию в мл, остальное — в граммах
  if (n === "вода") return "мл";
  return "г";
}

export function clampAmount(name: string, amount?: number): number {
  // Простейшая защита от неадекватных значений
  if (!Number.isFinite(amount!)) amount = 0;
  amount = Math.round(Math.max(0, amount!));

  const n = name.toLowerCase();
  if (n === "вода") return Math.min(amount, 5000);
  if (n === "соль" || n === "перец") return Math.min(amount, 5); // ложки
  if (n === "масло") return Math.min(amount, 5); // ложки
  return Math.min(amount, 3000); // граммы
}
