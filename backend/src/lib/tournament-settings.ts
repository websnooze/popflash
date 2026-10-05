import { z } from 'zod'
import { ACTIVE_DUTY_MAPS, DATHOST_LOCATION_IDS } from './constants'
import { matchSettingsSchema } from './lobby-settings'

export const tournamentFormatSchema = z.enum([
  'single_elim',
  'double_elim',
  'swiss',
  'round_robin',
])

export const createTeamSchema = z.object({
  name: z.string().min(1).max(64),
  tag: z.string().min(1).max(8).optional(),
  logoUrl: z.string().url().optional(),
})

export const updateTeamSchema = createTeamSchema.partial()

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['captain', 'player', 'coach']).default('player'),
})

export const tournamentSettingsSchema = z.object({
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
  location: z.enum(DATHOST_LOCATION_IDS as unknown as [string, ...string[]]).default('stockholm'),
  locationSelectionMode: z.enum(['host', 'captains_ban', 'players_vote']).default('host'),
  mapSelectionMode: z.enum(['host', 'captains_veto', 'players_vote']).default('host'),
  startMode: z.enum(['by_host', 'when_ready']).default('by_host'),
  mapPool: z.array(z.string().min(1)).min(1).default([...ACTIVE_DUTY_MAPS]),
  matchSettings: matchSettingsSchema,
  roundRobinDouble: z.boolean().optional(),
  swissRounds: z.number().int().min(1).max(12).optional(),
})

export const createTournamentSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(4000).default(''),
  imageUrl: z.string().url().optional(),
  format: tournamentFormatSchema,
  teamSize: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).default(5),
  maxTeams: z.number().int().min(2).max(128).default(16),
  checkInRequired: z.boolean().default(false),
  registrationOpensAt: z.string().datetime().optional(),
  registrationClosesAt: z.string().datetime().optional(),
  startsAt: z.string().datetime().optional(),
  settings: tournamentSettingsSchema.optional(),
})

export const updateTournamentSchema = createTournamentSchema.partial()

export const registerEntrySchema = z.object({
  teamId: z.string().uuid(),
})

export const patchFixtureSchema = z.object({
  scheduledAt: z.string().datetime().nullable().optional(),
  score1: z.number().int().min(0).optional(),
  score2: z.number().int().min(0).optional(),
  status: z
    .enum(['scheduled', 'ready', 'lobby_open', 'live', 'completed', 'walkover'])
    .optional(),
  winnerEntryId: z.string().uuid().nullable().optional(),
})

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return base || 'tournament'
}
