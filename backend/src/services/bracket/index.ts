import type { TournamentFormat } from '../../db/schema/tournaments'
import { generateDoubleElim } from './double-elim'
import { generateRoundRobin } from './round-robin'
import { generateSingleElim } from './single-elim'
import { computeSwissStandings, generateSwissRound1, pairSwissRound } from './swiss'
import type { GeneratedFixture, GenerateBracketOptions, StandingRow } from './types'
import { fixtureKey } from './utils'

export type { GeneratedFixture, GenerateBracketOptions, StandingRow }
export { computeSwissStandings, pairSwissRound, fixtureKey }

export function generateBracket(
  format: TournamentFormat,
  entryIds: string[],
  options: GenerateBracketOptions,
): GeneratedFixture[] {
  if (entryIds.length < 2) return []

  switch (format) {
    case 'single_elim':
      return generateSingleElim(entryIds)
    case 'double_elim':
      return generateDoubleElim(entryIds)
    case 'round_robin':
      return generateRoundRobin(entryIds, options.roundRobinDouble ?? false)
    case 'swiss':
      return generateSwissRound1(entryIds)
    default:
      return []
  }
}

export type AdvanceInput = {
  id: string
  team1EntryId: string | null
  team2EntryId: string | null
  winnerEntryId: string | null
  nextMatchId: string | null
  nextSlot: number | null
  loserNextMatchId: string | null
  loserNextSlot: number | null
}

export type AdvancePatch = {
  nextMatchId: string
  slot: 1 | 2
  entryId: string
} | null

export function advanceWinner(fixture: AdvanceInput): { win: AdvancePatch; lose: AdvancePatch } {
  const winner = fixture.winnerEntryId
  if (!winner) return { win: null, lose: null }

  const loser =
    fixture.team1EntryId === winner
      ? fixture.team2EntryId
      : fixture.team2EntryId === winner
        ? fixture.team1EntryId
        : null

  const win: AdvancePatch =
    fixture.nextMatchId && fixture.nextSlot
      ? {
          nextMatchId: fixture.nextMatchId,
          slot: fixture.nextSlot as 1 | 2,
          entryId: winner,
        }
      : null

  const lose: AdvancePatch =
    loser && fixture.loserNextMatchId && fixture.loserNextSlot
      ? {
          nextMatchId: fixture.loserNextMatchId,
          slot: fixture.loserNextSlot as 1 | 2,
          entryId: loser,
        }
      : null

  return { win, lose }
}

export function computeRoundRobinStandings(
  entryIds: string[],
  results: { team1EntryId: string | null; team2EntryId: string | null; score1: number; score2: number }[],
): StandingRow[] {
  return computeSwissStandings(entryIds, results)
}
