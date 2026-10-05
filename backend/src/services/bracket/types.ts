import type { TournamentFormat } from '../../db/schema/tournaments'

export type BracketSide = 'winners' | 'losers' | 'grand_final' | 'swiss' | 'group'

export type FixtureLinkTarget = {
  roundKey: string
  position: number
  slot: 1 | 2
}

export type GeneratedFixture = {
  roundKey: string
  bracketSide: BracketSide | null
  position: number
  team1EntryId: string | null
  team2EntryId: string | null
  nextWin?: FixtureLinkTarget | null
  nextLose?: FixtureLinkTarget | null
}

export type GenerateBracketOptions = {
  bestOf: number
  roundRobinDouble?: boolean
  swissRounds?: number
  randomSeed?: boolean
}

export type StandingRow = {
  entryId: string
  wins: number
  losses: number
  draws: number
  mapDiff: number
  roundDiff: number
  buchholz: number
}

export type BracketFormat = TournamentFormat
