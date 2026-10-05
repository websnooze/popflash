import { READY_CHECK_SECONDS } from '../../lib/constants'
import { acquireLock, redis, RedisKeys, releaseLock } from '../../lib/redis'

type ExpireHandler = (lobbyId: string) => Promise<void>

/**
 * Distributed ready-check scheduler backed by a Redis sorted set.
 * Score = unix ms when the check expires; members = lobbyId.
 */
class ReadyCheckScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private handler: ExpireHandler | null = null
  private ticking = false

  start(onExpire: ExpireHandler): void {
    this.handler = onExpire
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, 500)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async schedule(lobbyId: string, endsAtMs = Date.now() + READY_CHECK_SECONDS * 1000): Promise<void> {
    await redis.zadd(RedisKeys.readyChecksZset, endsAtMs, lobbyId)
    const ttlMs = Math.max(endsAtMs - Date.now(), 0) + 5_000
    await redis.set(RedisKeys.readyCheck(lobbyId), String(endsAtMs), 'PX', ttlMs)
  }

  async clear(lobbyId: string): Promise<void> {
    await redis.zrem(RedisKeys.readyChecksZset, lobbyId)
    await redis.del(RedisKeys.readyCheck(lobbyId))
  }

  private async tick(): Promise<void> {
    if (this.ticking || !this.handler) return

    const leaderToken = await acquireLock(RedisKeys.lockReadyCheckLeader, 2)
    if (!leaderToken) return

    this.ticking = true
    try {
      const now = Date.now()
      const due = await redis.zrangebyscore(RedisKeys.readyChecksZset, 0, now)
      for (const lobbyId of due) {
        const lockToken = await acquireLock(RedisKeys.lockReadyExpire(lobbyId), 15)
        if (!lockToken) continue

        try {
          await redis.zrem(RedisKeys.readyChecksZset, lobbyId)
          await redis.del(RedisKeys.readyCheck(lobbyId))
          await this.handler(lobbyId)
        } catch (error) {
          console.error('[ready-check] expire failed', lobbyId, error)
        } finally {
          await releaseLock(RedisKeys.lockReadyExpire(lobbyId), lockToken)
        }
      }
    } finally {
      this.ticking = false
      await releaseLock(RedisKeys.lockReadyCheckLeader, leaderToken)
    }
  }
}

export const readyCheckScheduler = new ReadyCheckScheduler()
