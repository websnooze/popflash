import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { lobbies } from '../../db/schema'
import { readyCheckScheduler } from './ready-check'

/** Restore Redis ready-check timers from Postgres after a deploy or crash. */
export async function rehydrateReadyChecksFromDb(
  onExpire: (lobbyId: string) => Promise<void>,
): Promise<number> {
  const rows = await db.query.lobbies.findMany({
    where: eq(lobbies.status, 'ready_check'),
  })

  let restored = 0
  for (const lobby of rows) {
    if (!lobby.readyCheck?.active || !lobby.readyCheck.endsAt) continue

    const endsAtMs = new Date(lobby.readyCheck.endsAt).getTime()
    if (Number.isNaN(endsAtMs)) continue

    if (endsAtMs <= Date.now()) {
      await onExpire(lobby.id)
      continue
    }

    await readyCheckScheduler.schedule(lobby.id, endsAtMs)
    restored += 1
  }

  return restored
}
