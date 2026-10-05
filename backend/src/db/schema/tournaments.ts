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
import { lobbies } from './lobbies'
import type { LobbyMatchSettings } from './lobbies'
import { users } from './users'

export const teamMemberRoleEnum = pgEnum('team_member_role', ['captain', 'player', 'coach'])

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'draft',
  'registration',
  'check_in',
  'seeding',
  'live',
  'completed',
  'canceled',
])

export const tournamentFormatEnum = pgEnum('tournament_format', [
  'single_elim',
  'double_elim',
  'swiss',
  'round_robin',
])

export const tournamentEntryStatusEnum = pgEnum('tournament_entry_status', [
  'pending',
  'accepted',
  'checked_in',
  'disqualified',
  'withdrawn',
])

export const fixtureBracketSideEnum = pgEnum('fixture_bracket_side', [
  'winners',
  'losers',
  'grand_final',
  'swiss',
  'group',
])

export const fixtureStatusEnum = pgEnum('fixture_status', [
  'scheduled',
  'ready',
  'lobby_open',
  'live',
  'completed',
  'walkover',
])

export type TournamentSettings = {
  bestOf: 1 | 3 | 5
  location: string
  locationSelectionMode: 'host' | 'captains_ban' | 'players_vote'
  mapSelectionMode: 'host' | 'captains_veto' | 'players_vote'
  startMode: 'by_host' | 'when_ready'
  mapPool: string[]
  matchSettings: LobbyMatchSettings
  roundRobinDouble?: boolean
  swissRounds?: number
}

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  tag: text('tag'),
  logoUrl: text('logo_url'),
  captainUserId: uuid('captain_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamMemberRoleEnum('role').notNull().default('player'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId)],
)

export const tournaments = pgTable('tournaments', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  imageUrl: text('image_url'),
  organizerUserId: uuid('organizer_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  status: tournamentStatusEnum('status').notNull().default('draft'),
  format: tournamentFormatEnum('format').notNull(),
  teamSize: integer('team_size').notNull().default(5),
  maxTeams: integer('max_teams').notNull().default(16),
  checkInRequired: boolean('check_in_required').notNull().default(false),
  registrationOpensAt: timestamp('registration_opens_at', { withTimezone: true }),
  registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  settings: jsonb('settings').$type<TournamentSettings>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tournamentEntries = pgTable(
  'tournament_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    seed: integer('seed'),
    status: tournamentEntryStatusEnum('status').notNull().default('pending'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('tournament_entries_tournament_team_idx').on(table.tournamentId, table.teamId)],
)

export const tournamentMatches = pgTable('tournament_matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  tournamentId: uuid('tournament_id')
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  roundKey: text('round_key').notNull(),
  bracketSide: fixtureBracketSideEnum('bracket_side'),
  position: integer('position').notNull(),
  team1EntryId: uuid('team_1_entry_id').references(() => tournamentEntries.id, {
    onDelete: 'set null',
  }),
  team2EntryId: uuid('team_2_entry_id').references(() => tournamentEntries.id, {
    onDelete: 'set null',
  }),
  score1: integer('score_1').notNull().default(0),
  score2: integer('score_2').notNull().default(0),
  bestOf: integer('best_of').notNull().default(1),
  status: fixtureStatusEnum('status').notNull().default('scheduled'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  lobbyId: uuid('lobby_id').references(() => lobbies.id, { onDelete: 'set null' }),
  winnerEntryId: uuid('winner_entry_id').references(() => tournamentEntries.id, {
    onDelete: 'set null',
  }),
  nextMatchId: uuid('next_match_id'),
  nextSlot: integer('next_slot'),
  loserNextMatchId: uuid('loser_next_match_id'),
  loserNextSlot: integer('loser_next_slot'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Team = typeof teams.$inferSelect
export type TeamMember = typeof teamMembers.$inferSelect
export type Tournament = typeof tournaments.$inferSelect
export type TournamentEntry = typeof tournamentEntries.$inferSelect
export type TournamentMatch = typeof tournamentMatches.$inferSelect
export type TournamentFormat = (typeof tournamentFormatEnum.enumValues)[number]
