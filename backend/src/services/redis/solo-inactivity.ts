import { LOBBY_SOLO_INACTIVITY_SECONDS } from '../../lib/constants'
import { acquireLock, redis, RedisKeys, releaseLock } from '../../lib/redis'

type ExpireHandler = (lobbyId: string) => Promise<void>

/**
 * Closes lobbies that stay at exactly 1 player with no activity.
 * Backed by a Redis sorted set (score = expire-at unix ms).
 */
class SoloInactivityScheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private handler: ExpireHandler | null = null
  private ticking = false

  start(onExpire: ExpireHandler): void {
    this.handler = onExpire
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, 1000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async touch(
    lobbyId: string,
    expiresAtMs = Date.now() + LOBBY_SOLO_INACTIVITY_SECONDS * 1000,
  ): Promise<void> {
    await redis.zadd(RedisKeys.soloInactivityZset, expiresAtMs, lobbyId)
  }

  async clear(lobbyId: string): Promise<void> {
    await redis.zrem(RedisKeys.soloInactivityZset, lobbyId)
  }

  private async tick(): Promise<void> {
    if (this.ticking || !this.handler) return

    const leaderToken = await acquireLock(RedisKeys.lockSoloInactivityLeader, 2)
    if (!leaderToken) return

    this.ticking = true
    try {
      const now = Date.now()
      const due = await redis.zrangebyscore(RedisKeys.soloInactivityZset, 0, now)
      for (const lobbyId of due) {
        const lockToken = await acquireLock(RedisKeys.lockSoloInactivityExpire(lobbyId), 15)
        if (!lockToken) continue

        try {
          await redis.zrem(RedisKeys.soloInactivityZset, lobbyId)
          await this.handler(lobbyId)
        } catch (error) {
          console.error('[solo-inactivity] expire failed', lobbyId, error)
        } finally {
          await releaseLock(RedisKeys.lockSoloInactivityExpire(lobbyId), lockToken)
        }
      }
    } finally {
      this.ticking = false
      await releaseLock(RedisKeys.lockSoloInactivityLeader, leaderToken)
    }
  }
}

export const soloInactivityScheduler = new SoloInactivityScheduler()
