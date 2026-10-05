import postgres from 'postgres'
import { randomBytes } from 'node:crypto'

const sql = postgres(process.env.POSTGRES_URL!)

await sql`
  ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS invite_token text
`

const missing = await sql<{ id: string }[]>`
  SELECT id FROM teams WHERE invite_token IS NULL OR invite_token = ''
`

for (const row of missing) {
  const token = randomBytes(16).toString('base64url')
  await sql`UPDATE teams SET invite_token = ${token} WHERE id = ${row.id}`
}

await sql`
  ALTER TABLE teams
  ALTER COLUMN invite_token SET NOT NULL
`

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_token_idx ON teams (invite_token)
`

console.log('team invites migration done')
await sql.end()
