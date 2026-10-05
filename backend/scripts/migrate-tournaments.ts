import postgres from 'postgres'

const sql = postgres(process.env.POSTGRES_URL!)

await sql`CREATE TYPE team_member_role AS ENUM ('captain', 'player', 'coach')`
await sql`CREATE TYPE tournament_status AS ENUM ('draft', 'registration', 'check_in', 'seeding', 'live', 'completed', 'canceled')`
await sql`CREATE TYPE tournament_format AS ENUM ('single_elim', 'double_elim', 'swiss', 'round_robin')`
await sql`CREATE TYPE tournament_entry_status AS ENUM ('pending', 'accepted', 'checked_in', 'disqualified', 'withdrawn')`
await sql`CREATE TYPE fixture_bracket_side AS ENUM ('winners', 'losers', 'grand_final', 'swiss', 'group')`
await sql`CREATE TYPE fixture_status AS ENUM ('scheduled', 'ready', 'lobby_open', 'live', 'completed', 'walkover')`

await sql`
  CREATE TABLE IF NOT EXISTS teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    tag text,
    logo_url text,
    captain_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_member_role NOT NULL DEFAULT 'player',
    created_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_idx ON team_members (team_id, user_id)
`

await sql`
  CREATE TABLE IF NOT EXISTS tournaments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    image_url text,
    organizer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status tournament_status NOT NULL DEFAULT 'draft',
    format tournament_format NOT NULL,
    team_size integer NOT NULL DEFAULT 5,
    max_teams integer NOT NULL DEFAULT 16,
    check_in_required boolean NOT NULL DEFAULT false,
    registration_opens_at timestamptz,
    registration_closes_at timestamptz,
    starts_at timestamptz,
    settings jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS tournament_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
    seed integer,
    status tournament_entry_status NOT NULL DEFAULT 'pending',
    registered_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_tournament_team_idx
  ON tournament_entries (tournament_id, team_id)
`

await sql`
  CREATE TABLE IF NOT EXISTS tournament_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_key text NOT NULL,
    bracket_side fixture_bracket_side,
    position integer NOT NULL,
    team_1_entry_id uuid REFERENCES tournament_entries(id) ON DELETE SET NULL,
    team_2_entry_id uuid REFERENCES tournament_entries(id) ON DELETE SET NULL,
    score_1 integer NOT NULL DEFAULT 0,
    score_2 integer NOT NULL DEFAULT 0,
    best_of integer NOT NULL DEFAULT 1,
    status fixture_status NOT NULL DEFAULT 'scheduled',
    scheduled_at timestamptz,
    lobby_id uuid REFERENCES lobbies(id) ON DELETE SET NULL,
    winner_entry_id uuid REFERENCES tournament_entries(id) ON DELETE SET NULL,
    next_match_id uuid,
    next_slot integer,
    loser_next_match_id uuid,
    loser_next_slot integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS tournament_match_id uuid REFERENCES tournament_matches(id) ON DELETE SET NULL
`

console.log('tournaments migration done')
await sql.end()
