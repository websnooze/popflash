import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const lobbyStatusEnum = pgEnum('lobby_status', [
  'waiting',
  'ready_check',
  'map_veto',
  'launching',
  'in_match',
  'closed',
])

export const lobbyTeamEnum = pgEnum('lobby_team', [
  'unassigned',
  'team1',
  'team2',
  'spectator',
])

export type LobbyMatchSettings = {
  connectTime: number
  matchBeginCountdown: number
  enableTechPause: boolean
  waitForGotv: boolean
  enablePlugin: boolean
  voiceChat: 'allies_only' | 'all_players'
  knifeRound: boolean
  maxRounds: 16 | 24 | 30 | 60
  overtime: boolean
  startMoney: number
  maxMoney: number
  overtimeMoney: number
  armor: 'default' | 'kevlar' | 'kevlar_helmet'
  headshotOnly: boolean
  pauseCount: number
  pauseDuration: number
  freezeTime: number
}

export const DEFAULT_MATCH_SETTINGS: LobbyMatchSettings = {
  connectTime: 300,
  matchBeginCountdown: 30,
  enableTechPause: true,
  waitForGotv: false,
  enablePlugin: true,
  voiceChat: 'allies_only',
  knifeRound: true,
  maxRounds: 24,
  overtime: true,
  startMoney: 800,
  maxMoney: 16000,
  overtimeMoney: 10000,
  armor: 'default',
  headshotOnly: false,
  pauseCount: 4,
  pauseDuration: 60,
  freezeTime: 15,
}

export type LobbyTemplateSettings = {
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
}

export type VetoBan = {
  map: string
  team: 'team1' | 'team2'
  byUserId: string
  at: string
}

export type VetoState = {
  status: 'idle' | 'in_progress' | 'completed'
  remainingMaps: string[]
  bannedMaps: VetoBan[]
  turnTeam: 'team1' | 'team2' | null
  selectedMap: string | null
  startedAt: string | null
  completedAt: string | null
}

export const DEFAULT_VETO_STATE: VetoState = {
  status: 'idle',
  remainingMaps: [],
  bannedMaps: [],
  turnTeam: null,
  selectedMap: null,
  startedAt: null,
  completedAt: null,
}

export type ReadyCheckState = {
  active: boolean
  endsAt: string | null
}

export const DEFAULT_READY_CHECK: ReadyCheckState = {
  active: false,
  endsAt: null,
}

export const lobbies = pgTable('lobbies', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  hostUserId: uuid('host_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  status: lobbyStatusEnum('status').notNull().default('waiting'),
  teamSize: integer('team_size').notNull().default(5),
  bestOf: integer('best_of').notNull().default(1),
  location: text('location').notNull().default('stockholm'),
  locationSelectionMode: text('location_selection_mode').notNull().default('host'),
  map: text('map'),
  mapPool: jsonb('map_pool').$type<string[]>().notNull(),
  mapSelectionMode: text('map_selection_mode').notNull().default('host'),
  startMode: text('start_mode').notNull().default('by_host'),
  privacy: text('privacy').notNull().default('public'),
  lobbyPasswordHash: text('lobby_password_hash'),
  team1Name: text('team_1_name').notNull().default('Team A'),
  team2Name: text('team_2_name').notNull().default('Team B'),
  allowJoinTeam: boolean('allow_join_team').notNull().default(true),
  matchSettings: jsonb('match_settings')
    .$type<LobbyMatchSettings>()
    .notNull()
    .default(DEFAULT_MATCH_SETTINGS),
  veto: jsonb('veto').$type<VetoState>().notNull().default(DEFAULT_VETO_STATE),
  readyCheck: jsonb('ready_check')
    .$type<ReadyCheckState>()
    .notNull()
    .default(DEFAULT_READY_CHECK),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const lobbyPlayers = pgTable(
  'lobby_players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lobbyId: uuid('lobby_id')
      .notNull()
      .references(() => lobbies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    team: lobbyTeamEnum('team').notNull().default('unassigned'),
    isReady: boolean('is_ready').notNull().default(false),
    isCaptain: boolean('is_captain').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('lobby_players_lobby_user_idx').on(table.lobbyId, table.userId)],
)

export const lobbyChatMessages = pgTable('lobby_chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  lobbyId: uuid('lobby_id')
    .notNull()
    .references(() => lobbies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull().default('general'),
  team: text('team'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const lobbyTemplates = pgTable('lobby_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  settings: jsonb('settings').$type<LobbyTemplateSettings>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Lobby = typeof lobbies.$inferSelect
export type NewLobby = typeof lobbies.$inferInsert
export type LobbyPlayer = typeof lobbyPlayers.$inferSelect
export type NewLobbyPlayer = typeof lobbyPlayers.$inferInsert
export type LobbyChatMessage = typeof lobbyChatMessages.$inferSelect
export type NewLobbyChatMessage = typeof lobbyChatMessages.$inferInsert
export type LobbyTemplate = typeof lobbyTemplates.$inferSelect
export type NewLobbyTemplate = typeof lobbyTemplates.$inferInsert
export type LobbyStatus = (typeof lobbyStatusEnum.enumValues)[number]
export type LobbyTeam = (typeof lobbyTeamEnum.enumValues)[number]
export type MapSelectionMode = string
