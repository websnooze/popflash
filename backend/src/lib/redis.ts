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

/** Blocking worker (BRPOP) — separate connection. */
export const redisWorker = new Redis(env.REDIS_URL, {
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

redisWorker.on('error', (err) => {
  console.error('[redis] worker error:', err.message)
})

export const RedisChannels = {
  ws: 'fragstack:ws',
  tournament: 'fragstack:tournament',
} as const

export const RedisKeys = {
  session: (tokenHash: string) => `fragstack:session:${tokenHash}`,
  readyChecksZset: 'fragstack:ready_checks',
  readyCheck: (lobbyId: string) => `fragstack:ready_check:${lobbyId}`,
  lockReadyCheckLeader: 'fragstack:lock:ready_check_leader',
  lockLaunch: (lobbyId: string) => `fragstack:lock:launch:${lobbyId}`,
  lockReadyExpire: (lobbyId: string) => `fragstack:lock:ready_expire:${lobbyId}`,
  lockTournamentBracket: (tournamentId: string) => `fragstack:lock:tournament_bracket:${tournamentId}`,
  lockTournamentFixture: (tournamentId: string, matchId: string) =>
    `fragstack:lock:tournament_fixture:${tournamentId}:${matchId}`,
  lockTournamentAdvance: (tournamentId: string, matchId: string) =>
    `fragstack:lock:tournament_advance:${tournamentId}:${matchId}`,
  webhookDathost: (matchId: string, fingerprint: string) =>
    `fragstack:webhook:dathost:${matchId}:${fingerprint}`,
  webhookFragstack: (matchId: string, fingerprint: string) =>
    `fragstack:webhook:fragstack:${matchId}:${fingerprint}`,
  rateLimitChat: (userId: string) => `fragstack:rl:chat:${userId}`,
  rateLimitWsAction: (userId: string) => `fragstack:rl:ws_action:${userId}`,
  rateLimitCreateLobby: (userId: string) => `fragstack:rl:create_lobby:${userId}`,
  rateLimitJoinLobby: (userId: string) => `fragstack:rl:join_lobby:${userId}`,
  rateLimitSteamAuth: (ip: string) => `fragstack:rl:steam_auth:${ip}`,
  rateLimitTournamentRegister: (userId: string) => `fragstack:rl:tournament_register:${userId}`,
  rateLimitInviteRegenerate: (teamId: string) => `fragstack:rl:invite_regen:${teamId}`,
  publicLobbies: 'fragstack:cache:public_lobbies',
  cacheLobbyView: (lobbyId: string) => `fragstack:cache:lobby_view:${lobbyId}`,
  cacheTournament: (tournamentId: string) => `fragstack:cache:tournament:${tournamentId}`,
  cacheTeamView: (teamId: string, viewerId: string) =>
    `fragstack:cache:team_view:${teamId}:${viewerId}`,
  chatRecent: (lobbyId: string) => `fragstack:chat:recent:${lobbyId}`,
  presenceLobby: (lobbyId: string) => `fragstack:presence:lobby:${lobbyId}`,
  jobsQueue: 'fragstack:jobs',
  jobsDelayed: 'fragstack:jobs:delayed',
  dathostCircuitFailures: 'fragstack:circuit:dathost:failures',
  dathostCircuitOpen: 'fragstack:circuit:dathost:open',
} as const

const TERMINAL_WEBHOOK_EVENTS = new Set([
  'match_ended',
  'gotv_stopped',
  'match_canceled',
  'series_end',
  'match_started',
])

export function webhookClaimTtlSeconds(eventName: string | undefined): number {
  if (!eventName) return 300
  if (TERMINAL_WEBHOOK_EVENTS.has(eventName)) return 86_400
  return 120
}

export async function acquireLock(
  key: string,
  ttlSeconds: number,
  token = crypto.randomUUID(),
): Promise<string | null> {
  const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX')
  return result === 'OK' ? token : null
}

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

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    await redis.del(key)
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export async function invalidateLobbyCaches(lobbyId: string): Promise<void> {
  await redis.del(RedisKeys.cacheLobbyView(lobbyId), RedisKeys.publicLobbies)
}

export async function invalidateTournamentCache(tournamentId: string): Promise<void> {
  await redis.del(RedisKeys.cacheTournament(tournamentId))
}

export async function invalidateTeamCache(teamId: string): Promise<void> {
  const keys = await redis.keys(`fragstack:cache:team_view:${teamId}:*`)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}

export async function touchLobbyPresence(lobbyId: string, userId: string): Promise<void> {
  const key = RedisKeys.presenceLobby(lobbyId)
  await redis.sadd(key, userId)
  await redis.expire(key, 60)
}

export async function pushChatMessageCache(lobbyId: string, message: unknown): Promise<void> {
  const key = RedisKeys.chatRecent(lobbyId)
  await redis.lpush(key, JSON.stringify(message))
  await redis.ltrim(key, 0, 199)
  await redis.expire(key, 86_400)
}

const DATHOST_CIRCUIT_FAILURE_THRESHOLD = 5
const DATHOST_CIRCUIT_OPEN_SECONDS = 60

export async function dathostCircuitAllow(): Promise<boolean> {
  const open = await redis.get(RedisKeys.dathostCircuitOpen)
  return open !== '1'
}

export async function dathostCircuitRecordSuccess(): Promise<void> {
  await redis.del(RedisKeys.dathostCircuitFailures, RedisKeys.dathostCircuitOpen)
}

export async function dathostCircuitRecordFailure(): Promise<void> {
  const failures = await redis.incr(RedisKeys.dathostCircuitFailures)
  if (failures === 1) {
    await redis.expire(RedisKeys.dathostCircuitFailures, 120)
  }
  if (failures >= DATHOST_CIRCUIT_FAILURE_THRESHOLD) {
    await redis.set(RedisKeys.dathostCircuitOpen, '1', 'EX', DATHOST_CIRCUIT_OPEN_SECONDS)
    await redis.del(RedisKeys.dathostCircuitFailures)
  }
}

export async function closeRedis(): Promise<void> {
  await Promise.all([redis.quit(), redisSub.quit(), redisWorker.quit()])
}
