import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis?: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

// While Redis is down, ioredis keeps retrying to reconnect in the background
// and emits an 'error' event on every failed attempt. Without a listener,
// Node treats an unhandled 'error' event as fatal — attach a no-op so the
// background reconnect loop doesn't take the process down.
redis.on('error', () => {})

/**
 * Fixed-window rate limiter. Returns true if the caller is within the limit.
 * Deliberately simple (no external deps) — swap for a token-bucket
 * implementation if bursty traffic becomes a problem.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const bucketKey = `ratelimit:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`
  try {
    // A command's promise can sit unresolved for a while when the client is
    // mid-reconnect, which would otherwise stall the whole request — race it
    // against a short timeout so a dead Redis never blocks gameplay.
    const count = await Promise.race([
      (async () => {
        const c = await redis.incr(bucketKey)
        if (c === 1) await redis.expire(bucketKey, windowSeconds)
        return c
      })(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), 300)),
    ])
    return count <= limit
  } catch {
    // Redis being down shouldn't take core gameplay down with it — fail
    // open (no rate limiting) rather than 500 every request.
    return true
  }
}
