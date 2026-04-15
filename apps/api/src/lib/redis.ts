import { Redis } from '@upstash/redis'

// For local Docker Redis, we use a simple fetch-based client
// When moving to production, swap to Upstash credentials
export const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

export const cacheGet = async (key: string): Promise<string | null> => {
  if (!redis) return null
  return await redis.get(key)
}

export const cacheSet = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
  if (!redis) return
  await redis.set(key, value, { ex: ttlSeconds })
}

export const cacheDel = async (key: string): Promise<void> => {
  if (!redis) return
  await redis.del(key)
}