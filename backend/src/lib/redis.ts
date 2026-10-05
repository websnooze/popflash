import { Redis } from 'ioredis'
import { env } from '../config/env'

/** Command client (GET/SET/ZADD/PUBLISH/…). */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
})

/** Dedicated subscriber — cannot run regular commands while subscribed. */
export const redisSub = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
})

redis.on('error', (err) => {
  console.error('[redis] command client error:', err.message)
})

redisSub.on('error', (err) => {
  console.error('[redis] subscriber error:', err.message)
})

export const RedisChannels = {
  ws: 'fragstack:ws',
  tournament: 'fragstack:tournament',
} as const

export const RedisKeys = {
  session: (tokenHash: string) => `fragstack:session:${tokenHash}`,
  readyChecksZset: 'fragstack:ready_checks',
  readyCheck: (lobbyId: string) => `fragstack:ready_check:${lobbyId}`,
  lockLaunch: (lobbyId: string) => `fragstack:lock:launch:${lobbyId}`,
  lockReadyExpire: (lobbyId: string) => `fragstack:lock:ready_expire:${lobbyId}`,
  webhookDathost: (matchId: string, fingerprint: string) =>
    `fragstack:webhook:dathost:${matchId}:${fingerprint}`,
  webhookFragstack: (matchId: string, fingerprint: string) =>
    `fragstack:webhook:fragstack:${matchId}:${fingerprint}`,
  rateLimitChat: (userId: string) => `fragstack:rl:chat:${userId}`,
  publicLobbies: 'fragstack:cache:public_lobbies',
} as const

/**
 * Acquire a simple NX lock. Returns true if acquired.
 * Caller should release with `releaseLock` in a finally block when possible.
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number,
  token = crypto.randomUUID(),
): Promise<string | null> {
  const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX')
  return result === 'OK' ? token : null
}

/** Release lock only if we still own it (token match). */
export async function releaseLock(key: string, token: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `
  await redis.eval(script, 1, key, token)
}

/** SET NX with TTL — returns true if this is the first time (claim succeeded). */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
  return result === 'OK'
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, windowSeconds)
  }
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  }
}

export async function closeRedis(): Promise<void> {
  await Promise.all([redis.quit(), redisSub.quit()])
}
