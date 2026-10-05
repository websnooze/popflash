import type { ServerWebSocket } from 'bun'
import { env } from '../../config/env'
import { AppError } from '../../lib/errors'
import { touchLobbyPresence } from '../../lib/redis'
import { authService } from '../auth.service'
import { lobbyService } from '../lobby.service'
import { wsHub } from './hub'
import type { WsClientMessage, WsSessionData } from './types'

function parseMessage(raw: string | Buffer): WsClientMessage | null {
  try {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8')
    return JSON.parse(text) as WsClientMessage
  } catch {
    return null
  }
}

function send(ws: ServerWebSocket<WsSessionData>, payload: unknown): void {
  try {
    ws.send(JSON.stringify(payload))
  } catch {
    // socket closing
  }
}

/** In-memory rate limit — avoids remote Redis RTT on every click (join team, ready…). */
const wsActionBuckets = new Map<string, { count: number; resetAt: number }>()

function allowWsAction(userId: string, limit = 40, windowMs = 10_000): boolean {
  const now = Date.now()
  const bucket = wsActionBuckets.get(userId)
  if (!bucket || now >= bucket.resetAt) {
    wsActionBuckets.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}

function refreshPresence(ws: ServerWebSocket<WsSessionData>): void {
  if (!ws.data.userId) return
  for (const lobbyId of ws.data.subscribedLobbyIds) {
    void touchLobbyPresence(lobbyId, ws.data.userId)
  }
}

export const websocketHandlers = {
  async open(ws: ServerWebSocket<WsSessionData>) {
    wsHub.add(ws)
  },

  async message(ws: ServerWebSocket<WsSessionData>, message: string | Buffer) {
    const parsed = parseMessage(message)
    if (!parsed) {
      send(ws, { type: 'error', message: 'Invalid JSON message' })
      return
    }

    switch (parsed.type) {
      case 'ping':
        refreshPresence(ws)
        send(ws, { type: 'pong' })
        break

      case 'subscribe': {
        if (!parsed.lobbyId) {
          send(ws, { type: 'error', message: 'lobbyId is required' })
          return
        }
        wsHub.subscribe(ws, parsed.lobbyId)
        refreshPresence(ws)
        send(ws, { type: 'subscribed', lobbyId: parsed.lobbyId })
        try {
          const lobby = await lobbyService.getLobbyView(parsed.lobbyId)
          send(ws, { type: 'lobby_updated', lobbyId: parsed.lobbyId, payload: lobby })
        } catch {
          // lobby may not exist yet
        }
        break
      }

      case 'unsubscribe': {
        if (!parsed.lobbyId) {
          send(ws, { type: 'error', message: 'lobbyId is required' })
          return
        }
        wsHub.unsubscribe(ws, parsed.lobbyId)
        break
      }

      case 'subscribe_tournament': {
        if (!parsed.tournamentId) {
          send(ws, { type: 'error', message: 'tournamentId is required' })
          return
        }
        wsHub.subscribeTournament(ws, parsed.tournamentId)
        send(ws, { type: 'subscribed_tournament', tournamentId: parsed.tournamentId })
        break
      }

      case 'unsubscribe_tournament': {
        if (!parsed.tournamentId) {
          send(ws, { type: 'error', message: 'tournamentId is required' })
          return
        }
        wsHub.unsubscribeTournament(ws, parsed.tournamentId)
        break
      }

      case 'lobby_action': {
        if (!ws.data.userId) {
          send(ws, { type: 'error', message: 'Authentication required' })
          return
        }

        if (!allowWsAction(ws.data.userId)) {
          send(ws, { type: 'error', message: 'Too many actions — slow down' })
          return
        }

        if (!parsed.lobbyId || !parsed.action) {
          send(ws, { type: 'error', message: 'lobbyId and action are required' })
          return
        }

        try {
          let authUser = ws.data.authUser
          if (!authUser) {
            const { db } = await import('../../db')
            const { users } = await import('../../db/schema')
            const { eq } = await import('drizzle-orm')
            const row = await db.query.users.findFirst({ where: eq(users.id, ws.data.userId) })
            if (!row) {
              send(ws, { type: 'error', message: 'Authentication required' })
              return
            }
            authUser = {
              id: row.id,
              steamId64: row.steamId64,
              username: row.username,
              avatarUrl: row.avatarUrl,
              profileUrl: row.profileUrl,
            }
            ws.data.authUser = authUser
          }

          await lobbyService.handleAction(authUser, parsed.lobbyId, parsed.action)
          send(ws, { type: 'action_ok', actionType: parsed.action.type })
        } catch (error) {
          const messageText =
            error instanceof AppError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Action failed'
          send(ws, { type: 'error', message: messageText })
        }
        break
      }

      default:
        send(ws, { type: 'error', message: 'Unknown message type' })
    }
  },

  close(ws: ServerWebSocket<WsSessionData>) {
    wsHub.remove(ws)
  },
}

export async function authenticateWebSocket(
  req: Request,
): Promise<{ userId: string | null }> {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const cookiePattern = new RegExp(`(?:^|;\\s*)${env.COOKIE_NAME}=([^;]+)`)
  const match = cookieHeader.match(cookiePattern)
  const tokenFromCookie = match?.[1] ? decodeURIComponent(match[1]) : undefined

  const url = new URL(req.url)
  const tokenFromQuery = url.searchParams.get('token') ?? undefined

  const user = await authService.resolveUser(tokenFromCookie ?? tokenFromQuery)
  return { userId: user?.id ?? null }
}
