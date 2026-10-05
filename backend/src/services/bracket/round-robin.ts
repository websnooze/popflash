import type { GeneratedFixture } from './types'

export function generateRoundRobin(entryIds: string[], double: boolean): GeneratedFixture[] {
  const fixtures: GeneratedFixture[] = []
  let round = 1

  for (let i = 0; i < entryIds.length; i++) {
    for (let j = i + 1; j < entryIds.length; j++) {
      fixtures.push({
        roundKey: `rr-${round}`,
        bracketSide: 'group',
        position: fixtures.filter((f) => f.roundKey === `rr-${round}`).length + 1,
        team1EntryId: entryIds[i]!,
        team2EntryId: entryIds[j]!,
        nextWin: null,
        nextLose: null,
      })
      if (fixtures.filter((f) => f.roundKey === `rr-${round}`).length >= Math.floor(entryIds.length / 2)) {
        round++
      }
    }
  }

  if (double) {
    const base = [...fixtures]
    for (const f of base) {
      fixtures.push({
        roundKey: `rr-${round++}`,
        bracketSide: 'group',
        position: 1,
        team1EntryId: f.team2EntryId,
        team2EntryId: f.team1EntryId,
        nextWin: null,
        nextLose: null,
      })
    }
  }

  return fixtures
}
