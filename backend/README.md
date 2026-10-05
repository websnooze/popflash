# Fragstack Backend

CS2 matchmaking backend built with **Bun**, **Hono**, **Drizzle**, and the **DatHost CS2 Match API**.

## Stack

- Bun + Hono (HTTP)
- Native Bun WebSockets (`/ws`)
- Drizzle ORM + PostgreSQL
- Steam OpenID authentication
- DatHost Match API (duplicate template → create match → webhooks → teardown)

## Setup

1. Copy `.env.example` → `.env` and fill in values
2. Apply schema: `bun run db:push`
3. Start: `bun run dev` (port **5004**)

## Required env

| Variable | Purpose |
|---|---|
| `POSTGRES_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Cookie session secret (≥32 chars) |
| `PUBLIC_URL` | Public backend URL (Steam return + DatHost webhooks) |
| `FRONTEND_URL` | Frontend origin (CORS + post-login redirect) |
| `STEAM_API_KEY` | Steam Web API key |
| `DATHOST_EMAIL` / `DATHOST_PASSWORD` | DatHost Basic auth |
| `DATHOST_TEMPLATE_SERVER_ID` | Stopped CS2 template server ID |
| `DATHOST_WEBHOOK_SECRET` | Shared webhook `Authorization` header |

## HTTP API

### Auth
- `GET /auth/steam` — start Steam login
- `GET /auth/steam/callback` — Steam OpenID callback
- `GET /auth/me` — current user
- `POST /auth/logout` — destroy session

### Lobbies
- `GET /lobbies` — public lobbies
- `POST /lobbies` — create lobby
- `GET /lobbies/:lobbyId` — lobby details
- `POST /lobbies/join` — `{ "code": "ABC123" }`
- `POST /lobbies/:lobbyId/leave`
- `POST /lobbies/:lobbyId/ready` — `{ "isReady": true }`
- `POST /lobbies/:lobbyId/team` — `{ "team": "team1" }`
- `POST /lobbies/:lobbyId/map` — `{ "map": "de_mirage" }`
- `POST /lobbies/:lobbyId/location` — `{ "location": "stockholm" }`
- `POST /lobbies/:lobbyId/scramble` — random teams (host)

### Matches
- `POST /matches/launch/:lobbyId` — host launches DatHost match
- `GET /matches/:matchId`
- `GET /matches/lobby/:lobbyId/latest`
- `POST /matches/:matchId/cancel`

### Meta / webhooks
- `GET /health`
- `GET /maps`
- `GET /locations`
- `POST /webhooks/dathost` — DatHost event webhook

## WebSocket

Connect to `ws://localhost:5004/ws` (cookie session or `?token=`).

Client messages:
```json
{ "type": "subscribe", "lobbyId": "..." }
{ "type": "unsubscribe", "lobbyId": "..." }
{ "type": "ping" }
```

Server events: `lobby_updated`, `match_updated`, `match_connect`, `subscribed`, `pong`, `error`.

## Match lifecycle

1. Lobby fills → all ready → teams assigned
2. Host calls `POST /matches/launch/:lobbyId`
3. Backend duplicates DatHost template, configures server, starts CS2 Match API match
4. Webhooks drive status (`booting` → `waiting_players` → `live` → `finished`/`canceled`)
5. On end/cancel, duplicate server is deleted

## Scripts

```bash
bun run dev
bun run start
bun run db:generate
bun run db:push
bun run typecheck
```
