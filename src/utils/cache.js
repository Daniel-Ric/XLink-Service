import { LRUCache } from "lru-cache";

export const cache = new LRUCache({ max: 1000, ttl: 30000 });

export async function cached(key, fn, ttlMs = 30000) {
    const k = typeof key === "string" ? key : JSON.stringify(key);
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    const val = await fn();
    cache.set(k, val, { ttl: ttlMs });
    return val;
}
