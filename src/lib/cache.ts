import { Redis } from "@upstash/redis";

let redis: ReturnType<typeof Redis.fromEnv> | null = null;
try {
  // будет работать, если заданы переменные окружения:
  // UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN
  redis = Redis.fromEnv();
} catch {
  // локальный режим без Redis — используем in-memory Map (на Vercel в prod это НЕ сохранится)
}

const memory = new Map<string, any>();

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (redis) {
    const val = await redis.get<T>(key);
    return (val as T) ?? null;
  }
  return (memory.get(key) as T) ?? null;
}

export async function cacheSet<T = any>(
  key: string,
  value: T,
  ttlSeconds = 60 * 60 * 24 // 24h
): Promise<void> {
  if (redis) {
    await redis.set(key, value, { ex: ttlSeconds });
    return;
  }
  memory.set(key, value);
}

export function makeRecipesKey(products: string[]) {
  const norm = products
    .map((x) => String(x).trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return `recipes:${norm.join("|")}`;
}
