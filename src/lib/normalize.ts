// src/lib/normalize.ts
const synonyms: Record<string, string> = {
  "помидоры": "помидор",
  "томаты": "помидор",
  "лук репчатый": "лук",
  "шампиньоны": "грибы шампиньоны",
  "огурцы": "огурец",
  "яйца": "яйцо"
};

export function normalizeName(raw: string) {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return synonyms[t] ?? t;
}

export function makeCacheKey(products: string[]) {
  return Array.from(new Set(products.map(normalizeName).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}
