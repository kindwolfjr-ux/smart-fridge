// src/lib/cache.ts
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const mem = new Map<string, { value: Json; expiresAt: number }>();

/** Считать из кэша (in-memory как фолбэк) */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  // in-memory
  const hit = mem.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  return null;
}

/** Положить в кэш (in-memory как фолбэк) */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<boolean> {
  // допускаем только JSON-значения
  const safe: Json = (value as Json);
  mem.set(key, { value: safe, expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
}

/** Ключ для рецептов */
export function makeRecipesKey(products: string[]): string {
  return "recipes:" + products.map((p) => p.trim().toLowerCase()).filter(Boolean).sort().join("|");
}
