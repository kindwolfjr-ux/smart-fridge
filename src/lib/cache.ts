import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const CACHE_TTL = 60 * 60 * 24 * 7; // 7 дней

export async function getCachedRecipes(cacheKey: string) {
  try {
    const data = await redis.get(`rc:${cacheKey}`);
    return data ? (data as any[]) : null;
  } catch (e) {
    console.error("Ошибка при чтении из Redis:", e);
    return null;
  }
}

export async function setCachedRecipes(cacheKey: string, recipes: any[]) {
  try {
    await redis.set(`rc:${cacheKey}`, recipes, { ex: CACHE_TTL });
  } catch (e) {
    console.error("Ошибка при записи в Redis:", e);
  }
}

export async function incMetric(name: "cache_hit" | "cache_miss") {
  try {
    await redis.incr(`metrics:${name}`);
  } catch (e) {
    console.error("Ошибка при обновлении метрики:", e);
  }
}
