import type { GeneratedFixture } from './types'
import { bracketSeedOrder, fixtureKey, nextPowerOf2 } from './utils'

export function generateSingleElim(entryIds: string[]): GeneratedFixture[] {
  const n = entryIds.length
  if (n < 2) return []

  const size = nextPowerOf2(n)
  const order = bracketSeedOrder(size)
  const slots: (string | null)[] = order.map((seed) => (seed <= n ? entryIds[seed - 1]! : null))

  const fixtures: GeneratedFixture[] = []
  const roundCount = Math.log2(size)
  const roundNames =
    size === 2
      ? ['f']
      : size === 4
        ? ['sf', 'f']
        : size === 8
          ? ['qf', 'sf', 'f']
          : Array.from({ length: roundCount }, (_, i) => `r${i + 1}`)

  let prevRoundKeys: string[] = []
  let prevCount = size / 2

  for (let r = 0; r < roundCount; r++) {
    const roundKey = roundNames[r] ?? `r${r + 1}`
    const matchCount = prevCount
    prevCount = matchCount / 2
    const currentKeys: string[] = []

    for (let pos = 0; pos < matchCount; pos++) {
      const position = pos + 1
      currentKeys.push(fixtureKey(roundKey, position))

      let team1: string | null = null
      let team2: string | null = null

      if (r === 0) {
        team1 = slots[pos * 2] ?? null
        team2 = slots[pos * 2 + 1] ?? null
      }

      const nextRoundKey = r < roundCount - 1 ? (roundNames[r + 1] ?? `r${r + 2}`) : null
      const nextPosition = nextRoundKey ? Math.floor(pos / 2) + 1 : null
      const nextSlot = nextRoundKey ? ((pos % 2 === 0 ? 1 : 2) as 1 | 2) : null

      fixtures.push({
        roundKey,
        bracketSide: 'winners',
        position,
        team1EntryId: team1,
        team2EntryId: team2,
        nextWin:
          nextRoundKey && nextPosition && nextSlot
            ? { roundKey: nextRoundKey, position: nextPosition, slot: nextSlot }
            : null,
        nextLose: null,
      })
    }
    prevRoundKeys = currentKeys
  }

  return fixtures
}
