import postgres from 'postgres'

const sql = postgres(process.env.POSTGRES_URL!)

await sql`
  ALTER TABLE lobbies
  ADD COLUMN IF NOT EXISTS location_selection_mode text DEFAULT 'host' NOT NULL
`

await sql`
  CREATE TABLE IF NOT EXISTS lobby_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    settings jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS lobby_templates_user_id_idx
  ON lobby_templates (user_id)
`

console.log('advanced settings migration done')
await sql.end()
