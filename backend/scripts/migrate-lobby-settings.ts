import postgres from 'postgres'

const sql = postgres(process.env.POSTGRES_URL!)

await sql`ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS best_of integer DEFAULT 1 NOT NULL`
await sql`ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS start_mode text DEFAULT 'by_host' NOT NULL`
await sql`ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS privacy text DEFAULT 'public' NOT NULL`
await sql`ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS lobby_password_hash text`
await sql`ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS allow_join_team boolean DEFAULT true NOT NULL`
await sql`ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS ready_check jsonb DEFAULT '{"active":false,"endsAt":null}'::jsonb NOT NULL`

try {
  await sql`UPDATE lobbies SET privacy = CASE WHEN is_public THEN 'public' ELSE 'private' END`
} catch {
  // ignore
}

try {
  await sql`ALTER TABLE lobbies ALTER COLUMN map_selection_mode DROP DEFAULT`
  await sql`ALTER TABLE lobbies ALTER COLUMN map_selection_mode TYPE text USING map_selection_mode::text`
  await sql`ALTER TABLE lobbies ALTER COLUMN map_selection_mode SET DEFAULT 'host'`
  console.log('converted map_selection_mode to text')
} catch (error) {
  console.log('map_selection_mode cast:', error instanceof Error ? error.message : error)
}

await sql`UPDATE lobbies SET map_selection_mode = 'host' WHERE map_selection_mode IN ('manual', 'random')`
await sql`UPDATE lobbies SET map_selection_mode = 'captains_veto' WHERE map_selection_mode = 'veto'`

try {
  await sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lobbies' AND column_name = 'teams_locked'
      ) THEN
        UPDATE lobbies SET allow_join_team = NOT teams_locked;
      END IF;
    END $$;
  `
} catch (error) {
  console.log('teams_locked migrate:', error instanceof Error ? error.message : error)
}

await sql`ALTER TABLE lobbies DROP COLUMN IF EXISTS teams_locked`
await sql`ALTER TABLE lobbies DROP COLUMN IF EXISTS is_public`

console.log('migration done')
await sql.end()
