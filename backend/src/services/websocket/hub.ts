import type { ServerWebSocket } from 'bun'
import type { MatchConnectInfo, WsServerMessage, WsSessionData } from './types'

type Socket = ServerWebSocket<WsSessionData>

class WebSocketHub {
  private readonly sockets = new Set<Socket>()
  private readonly lobbyRooms = new Map<string, Set<Socket>>()

  add(socket: Socket): void {
    this.sockets.add(socket)
  }

  remove(socket: Socket): void {
    this.sockets.delete(socket)

    for (const lobbyId of socket.data.subscribedLobbyIds) {
      this.unsubscribe(socket, lobbyId)
    }
  }

  subscribe(socket: Socket, lobbyId: string): void {
    socket.data.subscribedLobbyIds.add(lobbyId)

    let room = this.lobbyRooms.get(lobbyId)
    if (!room) {
      room = new Set()
      this.lobbyRooms.set(lobbyId, room)
    }
    room.add(socket)
  }

  unsubscribe(socket: Socket, lobbyId: string): void {
    socket.data.subscribedLobbyIds.delete(lobbyId)
    const room = this.lobbyRooms.get(lobbyId)
    if (!room) return

    room.delete(socket)
    if (room.size === 0) {
      this.lobbyRooms.delete(lobbyId)
    }
  }

  emitChatMessage(lobbyId: string, payload: unknown, options?: { userIds?: string[] }): void {
    this.broadcastToLobby(lobbyId, {
      type: 'chat_message',
      lobbyId,
      payload,
    }, options?.userIds)
  }

  broadcastToLobby(lobbyId: string, message: WsServerMessage, userIds?: string[]): void {
    const room = this.lobbyRooms.get(lobbyId)
    if (!room) return

    const allowed = userIds ? new Set(userIds) : null
    const payload = JSON.stringify(message)
    for (const socket of room) {
      if (allowed && (!socket.data.userId || !allowed.has(socket.data.userId))) continue
      try {
        socket.send(payload)
      } catch {
        // Socket may already be closing
      }
    }
  }

  emitLobbyUpdated(lobbyId: string, payload: unknown): void {
    this.broadcastToLobby(lobbyId, {
      type: 'lobby_updated',
      lobbyId,
      payload,
    })
  }

  emitMatchUpdated(lobbyId: string, matchId: string, payload: unknown): void {
    this.broadcastToLobby(lobbyId, {
      type: 'match_updated',
      lobbyId,
      matchId,
      payload,
    })
  }

  emitMatchConnect(lobbyId: string, matchId: string, connect: MatchConnectInfo): void {
    this.broadcastToLobby(lobbyId, {
      type: 'match_connect',
      lobbyId,
      matchId,
      connect,
    })
  }
}

export const wsHub = new WebSocketHub()
