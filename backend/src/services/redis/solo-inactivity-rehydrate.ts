import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '../../db'
import { lobbies, lobbyPlayers } from '../../db/schema'
import { LOBBY_SOLO_INACTIVITY_SECONDS } from '../../lib/constants'
import { soloInactivityScheduler } from './solo-inactivity'

const IDLE_STATUSES = ['waiting', 'ready_check', 'map_veto'] as const

/**
 * Restore solo-inactivity timers after restart for lobbies that currently have exactly 1 player.
 */
export async function rehydrateSoloInactivityFromDb(
  onExpire: (lobbyId: string) => Promise<void>,
): Promise<number> {
  const rows = await db
    .select({
      id: lobbies.id,
      updatedAt: lobbies.updatedAt,
      playerCount: sql<number>`count(${lobbyPlayers.id})::int`,
    })
    .from(lobbies)
    .leftJoin(lobbyPlayers, eq(lobbyPlayers.lobbyId, lobbies.id))
    .where(and(ne(lobbies.status, 'closed'), inArray(lobbies.status, [...IDLE_STATUSES])))
    .groupBy(lobbies.id)
    .having(sql`count(${lobbyPlayers.id}) = 1`)

  let restored = 0
  for (const row of rows) {
    const lastActivity = row.updatedAt?.getTime() ?? Date.now()
    const expiresAtMs = lastActivity + LOBBY_SOLO_INACTIVITY_SECONDS * 1000

    if (expiresAtMs <= Date.now()) {
      await onExpire(row.id)
      continue
    }

    await soloInactivityScheduler.touch(row.id, expiresAtMs)
    restored += 1
  }

  return restored
}
