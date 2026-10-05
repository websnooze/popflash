import type { GeneratedFixture } from './types'
import { fixtureKey, nextPowerOf2 } from './utils'
import { generateSingleElim } from './single-elim'

/** Double elimination for up to 16 teams: winners bracket + losers path + grand final. */
export function generateDoubleElim(entryIds: string[]): GeneratedFixture[] {
  const n = entryIds.length
  if (n < 2) return []

  const wbFixtures = generateSingleElim(entryIds).map((f) => ({
    ...f,
    roundKey: `wb-${f.roundKey}`,
    nextWin: f.nextWin
      ? { ...f.nextWin, roundKey: `wb-${f.nextWin.roundKey}` }
      : f.roundKey === `wb-f` || f.roundKey.endsWith('-f')
        ? { roundKey: 'gf', position: 1, slot: 1 as const }
        : f.nextWin,
  }))

  // Fix grand final link on winners final
  for (const f of wbFixtures) {
    if (f.roundKey === 'wb-f' || (f.nextWin === null && f.roundKey.startsWith('wb-'))) {
      const isFinal =
        !wbFixtures.some(
          (other) =>
            other.roundKey.startsWith('wb-') &&
            other.roundKey !== f.roundKey &&
            other.roundKey > f.roundKey,
        ) && f.roundKey.startsWith('wb-')
      if (isFinal || f.roundKey === 'wb-f') {
        f.nextWin = { roundKey: 'gf', position: 1, slot: 1 }
      }
    }
  }

  const lastWb = wbFixtures.filter((f) => f.roundKey.startsWith('wb-'))
  const wbFinal = lastWb.find((f) => f.nextWin?.roundKey === 'gf') ?? lastWb[lastWb.length - 1]
  if (wbFinal && wbFinal.nextWin?.roundKey !== 'gf') {
    wbFinal.nextWin = { roundKey: 'gf', position: 1, slot: 1 }
  }

  for (const f of wbFixtures) {
    if (f.nextWin?.roundKey === 'gf') {
      f.nextLose = { roundKey: 'lb-f', position: 1, slot: 2 }
    } else if (f.nextWin) {
      f.nextLose = {
        roundKey: `lb-${f.roundKey.replace('wb-', '')}`,
        position: f.position,
        slot: 2,
      }
    }
  }

  const size = nextPowerOf2(n)
  const lbRounds = Math.max(1, Math.log2(size))
  const lbFixtures: GeneratedFixture[] = []

  for (let r = 0; r < lbRounds; r++) {
    const roundKey = r === lbRounds - 1 ? 'lb-f' : `lb-r${r + 1}`
    const matchCount = Math.max(1, size / Math.pow(2, r + 2))
    for (let pos = 1; pos <= matchCount; pos++) {
      const nextRound =
        r < lbRounds - 1 ? (r === lbRounds - 2 ? 'lb-f' : `lb-r${r + 2}`) : 'gf'
      lbFixtures.push({
        roundKey,
        bracketSide: 'losers',
        position: pos,
        team1EntryId: null,
        team2EntryId: null,
        nextWin:
          nextRound === 'gf'
            ? { roundKey: 'gf', position: 1, slot: 2 }
            : { roundKey: nextRound, position: Math.ceil(pos / 2), slot: (pos % 2 === 1 ? 1 : 2) as 1 | 2 },
        nextLose: null,
      })
    }
  }

  lbFixtures.push({
    roundKey: 'gf',
    bracketSide: 'grand_final',
    position: 1,
    team1EntryId: null,
    team2EntryId: null,
    nextWin: null,
    nextLose: null,
  })

  return [...wbFixtures, ...lbFixtures]
}
