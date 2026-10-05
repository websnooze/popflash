import type { GeneratedFixture, StandingRow } from './types'
import { shuffle } from './utils'

export function generateSwissRound1(entryIds: string[]): GeneratedFixture[] {
  const ordered = shuffle(entryIds)
  const fixtures: GeneratedFixture[] = []
  let pos = 1

  for (let i = 0; i < ordered.length; i += 2) {
    const t1 = ordered[i]!
    const t2 = i + 1 < ordered.length ? ordered[i + 1]! : null
    fixtures.push({
      roundKey: 'swiss-r1',
      bracketSide: 'swiss',
      position: pos++,
      team1EntryId: t1,
      team2EntryId: t2,
      nextWin: null,
      nextLose: null,
    })
  }

  return fixtures
}

export function pairSwissRound(
  roundNumber: number,
  entryIds: string[],
  standings: StandingRow[],
): GeneratedFixture[] {
  const scored = entryIds
    .map((id) => {
      const row = standings.find((s) => s.entryId === id)
      return { id, wins: row?.wins ?? 0, losses: row?.losses ?? 0, buchholz: row?.buchholz ?? 0 }
    })
    .sort((a, b) => b.wins - a.wins || b.buchholz - a.buchholz || a.id.localeCompare(b.id))

  const used = new Set<string>()
  const fixtures: GeneratedFixture[] = []
  let pos = 1
  const roundKey = `swiss-r${roundNumber}`

  for (const entry of scored) {
    if (used.has(entry.id)) continue
    const opponent = scored.find((o) => !used.has(o.id) && o.id !== entry.id && o.wins === entry.wins)
    if (!opponent) {
      fixtures.push({
        roundKey,
        bracketSide: 'swiss',
        position: pos++,
        team1EntryId: entry.id,
        team2EntryId: null,
        nextWin: null,
        nextLose: null,
      })
      used.add(entry.id)
      continue
    }
    used.add(entry.id)
    used.add(opponent.id)
    fixtures.push({
      roundKey,
      bracketSide: 'swiss',
      position: pos++,
      team1EntryId: entry.id,
      team2EntryId: opponent.id,
      nextWin: null,
      nextLose: null,
    })
  }

  return fixtures
}

export function computeSwissStandings(
  entryIds: string[],
  results: { team1EntryId: string | null; team2EntryId: string | null; score1: number; score2: number }[],
): StandingRow[] {
  const map = new Map<string, StandingRow>()
  for (const id of entryIds) {
    map.set(id, { entryId: id, wins: 0, losses: 0, draws: 0, mapDiff: 0, roundDiff: 0, buchholz: 0 })
  }

  for (const r of results) {
    if (!r.team1EntryId) continue
    const a = map.get(r.team1EntryId)!
    if (!r.team2EntryId) {
      a.wins += 1
      continue
    }
    const b = map.get(r.team2EntryId)!
    a.mapDiff += r.score1 - r.score2
    b.mapDiff += r.score2 - r.score1
    if (r.score1 > r.score2) {
      a.wins += 1
      b.losses += 1
    } else if (r.score2 > r.score1) {
      b.wins += 1
      a.losses += 1
    } else {
      a.draws += 1
      b.draws += 1
    }
  }

  const rows = [...map.values()]
  for (const row of rows) {
    let bh = 0
    for (const r of results) {
      if (r.team1EntryId === row.entryId && r.team2EntryId) {
        bh += map.get(r.team2EntryId)?.wins ?? 0
      } else if (r.team2EntryId === row.entryId && r.team1EntryId) {
        bh += map.get(r.team1EntryId)?.wins ?? 0
      }
    }
    row.buchholz = bh
  }
  return rows.sort((x, y) => y.wins - x.wins || y.buchholz - x.buchholz)
}
