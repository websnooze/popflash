import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { lobbies, lobbyTeamEnum } from './lobbies'
import { tournamentMatches } from './tournaments'
import { users } from './users'

export const matchStatusEnum = pgEnum('match_status', [
  'provisioning',
  'booting',
  'waiting_players',
  'live',
  'finished',
  'canceled',
])

export type PlayerMatchStats = {
  kills: number
  assists: number
  deaths: number
  mvps: number
  score: number
  headshots: number
  damageDealt: number
}

export type MatchEvent = {
  event: string
  timestamp: number
  payload?: Record<string, unknown>
}

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  lobbyId: uuid('lobby_id')
    .notNull()
    .references(() => lobbies.id, { onDelete: 'restrict' }),
  tournamentMatchId: uuid('tournament_match_id').references(() => tournamentMatches.id, {
    onDelete: 'set null',
  }),
  status: matchStatusEnum('status').notNull().default('provisioning'),
  dathostServerId: text('dathost_server_id'),
  dathostMatchId: text('dathost_match_id'),
  connectIp: text('connect_ip'),
  connectPort: integer('connect_port'),
  connectPassword: text('connect_password'),
  map: text('map').notNull(),
  location: text('location').notNull(),
  team1Name: text('team_1_name').notNull().default('Team A'),
  team2Name: text('team_2_name').notNull().default('Team B'),
  team1Score: integer('team_1_score').notNull().default(0),
  team2Score: integer('team_2_score').notNull().default(0),
  cancelReason: text('cancel_reason'),
  events: jsonb('events').$type<MatchEvent[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const matchPlayers = pgTable('match_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  steamId64: text('steam_id_64').notNull(),
  team: lobbyTeamEnum('team').notNull(),
  nickname: text('nickname').notNull(),
  connected: integer('connected').notNull().default(0),
  kicked: integer('kicked').notNull().default(0),
  stats: jsonb('stats').$type<PlayerMatchStats | null>(),
})

export type Match = typeof matches.$inferSelect
export type NewMatch = typeof matches.$inferInsert
export type MatchPlayer = typeof matchPlayers.$inferSelect
export type NewMatchPlayer = typeof matchPlayers.$inferInsert
export type MatchStatus = (typeof matchStatusEnum.enumValues)[number]
