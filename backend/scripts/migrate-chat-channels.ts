import postgres from 'postgres'

const sql = postgres(process.env.POSTGRES_URL!)

await sql`
  ALTER TABLE lobby_chat_messages
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'general' NOT NULL
`

await sql`
  ALTER TABLE lobby_chat_messages
  ADD COLUMN IF NOT EXISTS team text
`

await sql`
  UPDATE lobby_chat_messages
  SET channel = 'general'
  WHERE channel IS NULL OR channel = ''
`

console.log('chat channels migration done')
await sql.end()
