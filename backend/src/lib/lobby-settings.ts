import { z } from 'zod'
import { DATHOST_LOCATION_IDS } from './constants'
import { DEFAULT_MATCH_SETTINGS, type LobbyMatchSettings, type LobbyTemplateSettings } from '../db/schema'

export const mapIdSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith('de_') || /^workshop\/\d+$/.test(value),
    'Map must be an official map or workshop/{id}',
  )

export const matchSettingsSchema = z.object({
  connectTime: z.number().int().min(60).max(900).default(DEFAULT_MATCH_SETTINGS.connectTime),
  matchBeginCountdown: z
    .number()
    .int()
    .min(5)
    .max(120)
    .default(DEFAULT_MATCH_SETTINGS.matchBeginCountdown),
  enableTechPause: z.boolean().default(DEFAULT_MATCH_SETTINGS.enableTechPause),
  waitForGotv: z.boolean().default(DEFAULT_MATCH_SETTINGS.waitForGotv),
  enablePlugin: z.boolean().default(DEFAULT_MATCH_SETTINGS.enablePlugin),
  voiceChat: z.enum(['allies_only', 'all_players']).default(DEFAULT_MATCH_SETTINGS.voiceChat),
  knifeRound: z.boolean().default(DEFAULT_MATCH_SETTINGS.knifeRound),
  maxRounds: z
    .union([z.literal(16), z.literal(24), z.literal(30), z.literal(60)])
    .default(DEFAULT_MATCH_SETTINGS.maxRounds),
  overtime: z.boolean().default(DEFAULT_MATCH_SETTINGS.overtime),
  startMoney: z.number().int().min(800).max(16000).default(DEFAULT_MATCH_SETTINGS.startMoney),
  maxMoney: z.number().int().min(1).max(60000).default(DEFAULT_MATCH_SETTINGS.maxMoney),
  overtimeMoney: z
    .number()
    .int()
    .min(0)
    .max(16000)
    .default(DEFAULT_MATCH_SETTINGS.overtimeMoney),
  armor: z
    .enum(['default', 'kevlar', 'kevlar_helmet'])
    .default(DEFAULT_MATCH_SETTINGS.armor),
  headshotOnly: z.boolean().default(DEFAULT_MATCH_SETTINGS.headshotOnly),
  pauseCount: z.number().int().min(0).max(6).default(DEFAULT_MATCH_SETTINGS.pauseCount),
  pauseDuration: z.number().int().min(1).max(90).default(DEFAULT_MATCH_SETTINGS.pauseDuration),
  freezeTime: z.number().int().min(0).max(30).default(DEFAULT_MATCH_SETTINGS.freezeTime),
})

export const lobbySettingsPatchSchema = z.object({
  teamSize: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional(),
  location: z.enum(DATHOST_LOCATION_IDS as unknown as [string, ...string[]]).optional(),
  locationSelectionMode: z.enum(['host', 'captains_ban', 'players_vote']).optional(),
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
  mapSelectionMode: z.enum(['host', 'captains_veto', 'players_vote']).optional(),
  startMode: z.enum(['by_host', 'when_ready']).optional(),
  privacy: z.enum(['public', 'password', 'private']).optional(),
  lobbyPassword: z.string().min(4).max(64).nullable().optional(),
  allowJoinTeam: z.boolean().optional(),
  team1Name: z.string().min(1).max(32).optional(),
  team2Name: z.string().min(1).max(32).optional(),
  map: mapIdSchema.nullable().optional(),
  mapPool: z.array(mapIdSchema).min(1).optional(),
  matchSettings: matchSettingsSchema.partial().optional(),
})

export const createLobbySchema = z.object({
  teamSize: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).default(5),
  location: z.enum(DATHOST_LOCATION_IDS as unknown as [string, ...string[]]).default('stockholm'),
  locationSelectionMode: z.enum(['host', 'captains_ban', 'players_vote']).default('host'),
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
  mapSelectionMode: z.enum(['host', 'captains_veto', 'players_vote']).default('host'),
  startMode: z.enum(['by_host', 'when_ready']).default('by_host'),
  privacy: z.enum(['public', 'password', 'private']).default('public'),
  lobbyPassword: z.string().min(4).max(64).optional(),
  allowJoinTeam: z.boolean().default(true),
  team1Name: z.string().min(1).max(32).default('Team A'),
  team2Name: z.string().min(1).max(32).default('Team B'),
})

export const saveTemplateSchema = z.object({
  name: z.string().min(1).max(64),
  settings: z.object({
    teamSize: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]),
    bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    location: z.string().min(1),
    locationSelectionMode: z.enum(['host', 'captains_ban', 'players_vote']),
    mapSelectionMode: z.enum(['host', 'captains_veto', 'players_vote']),
    startMode: z.enum(['by_host', 'when_ready']),
    privacy: z.enum(['public', 'password', 'private']),
    allowJoinTeam: z.boolean(),
    mapPool: z.array(mapIdSchema).min(1),
    matchSettings: matchSettingsSchema,
  }),
})

export type CreateLobbyInput = z.infer<typeof createLobbySchema>
export type LobbySettingsPatch = z.infer<typeof lobbySettingsPatchSchema>
export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>

export function mergeMatchSettings(
  current: LobbyMatchSettings,
  patch?: Partial<LobbyMatchSettings>,
): LobbyMatchSettings {
  return { ...current, ...patch }
}

export function buildTemplateSettings(input: {
  teamSize: number
  bestOf: number
  location: string
  locationSelectionMode: string
  mapSelectionMode: string
  startMode: string
  privacy: string
  allowJoinTeam: boolean
  mapPool: string[]
  matchSettings: LobbyMatchSettings
}): LobbyTemplateSettings {
  return {
    teamSize: input.teamSize,
    bestOf: input.bestOf,
    location: input.location,
    locationSelectionMode: input.locationSelectionMode,
    mapSelectionMode: input.mapSelectionMode,
    startMode: input.startMode,
    privacy: input.privacy,
    allowJoinTeam: input.allowJoinTeam,
    mapPool: input.mapPool,
    matchSettings: input.matchSettings,
  }
}
