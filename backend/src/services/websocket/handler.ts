import type { ServerWebSocket } from 'bun'
import { env } from '../../config/env'
import { AppError } from '../../lib/errors'
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
        send(ws, { type: 'pong' })
        break

      case 'subscribe': {
        if (!parsed.lobbyId) {
          send(ws, { type: 'error', message: 'lobbyId is required' })
          return
        }
        wsHub.subscribe(ws, parsed.lobbyId)
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

      case 'lobby_action': {
        if (!ws.data.userId) {
          send(ws, { type: 'error', message: 'Authentication required' })
          return
        }
        if (!parsed.lobbyId || !parsed.action) {
          send(ws, { type: 'error', message: 'lobbyId and action are required' })
          return
        }

        try {
          const { db } = await import('../../db')
          const { users } = await import('../../db/schema')
          const { eq } = await import('drizzle-orm')
          const row = await db.query.users.findFirst({ where: eq(users.id, ws.data.userId) })
          if (!row) {
            send(ws, { type: 'error', message: 'Authentication required' })
            return
          }

          const authUser = {
            id: row.id,
            steamId64: row.steamId64,
            username: row.username,
            avatarUrl: row.avatarUrl,
            profileUrl: row.profileUrl,
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
