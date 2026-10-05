export function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/** Standard bracket seed order for size power of 2 (1 vs size, 2 vs size-1, …). */
export function bracketSeedOrder(size: number): number[] {
  if (size === 1) return [1]
  const half = bracketSeedOrder(size / 2)
  const result: number[] = []
  for (const seed of half) {
    result.push(seed)
    result.push(size + 1 - seed)
  }
  return result
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export function fixtureKey(roundKey: string, position: number): string {
  return `${roundKey}#${position}`
}
