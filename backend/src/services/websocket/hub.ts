import type { ServerWebSocket } from 'bun'
import { redis, redisSub, RedisChannels } from '../../lib/redis'
import type { MatchConnectInfo, WsServerMessage, WsSessionData } from './types'

type Socket = ServerWebSocket<WsSessionData>

type WsBusEnvelope = {
  message: WsServerMessage
  userIds?: string[]
}

type TournamentBusEnvelope = {
  tournamentId: string
  type: string
  payload: unknown
}

class WebSocketHub {
  private readonly sockets = new Set<Socket>()
  private readonly lobbyRooms = new Map<string, Set<Socket>>()
  private readonly tournamentRooms = new Map<string, Set<Socket>>()
  private subscribed = false

  async init(): Promise<void> {
    if (this.subscribed) return
    this.subscribed = true

    await redisSub.subscribe(RedisChannels.ws, RedisChannels.tournament)

    redisSub.on('message', (channel, raw) => {
      try {
        if (channel === RedisChannels.ws) {
          const envelope = JSON.parse(raw) as WsBusEnvelope
          this.deliverLobbyLocal(envelope.message, envelope.userIds)
          return
        }

        if (channel === RedisChannels.tournament) {
          const envelope = JSON.parse(raw) as TournamentBusEnvelope
          this.deliverTournamentLocal(envelope)
        }
      } catch (error) {
        console.error('[ws-hub] failed to handle redis message', error)
      }
    })
  }

  add(socket: Socket): void {
    this.sockets.add(socket)
  }

  remove(socket: Socket): void {
    this.sockets.delete(socket)

    for (const lobbyId of socket.data.subscribedLobbyIds) {
      this.unsubscribe(socket, lobbyId)
    }
    for (const tournamentId of socket.data.subscribedTournamentIds) {
      this.unsubscribeTournament(socket, tournamentId)
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

  subscribeTournament(socket: Socket, tournamentId: string): void {
    socket.data.subscribedTournamentIds.add(tournamentId)

    let room = this.tournamentRooms.get(tournamentId)
    if (!room) {
      room = new Set()
      this.tournamentRooms.set(tournamentId, room)
    }
    room.add(socket)
  }

  unsubscribeTournament(socket: Socket, tournamentId: string): void {
    socket.data.subscribedTournamentIds.delete(tournamentId)
    const room = this.tournamentRooms.get(tournamentId)
    if (!room) return

    room.delete(socket)
    if (room.size === 0) {
      this.tournamentRooms.delete(tournamentId)
    }
  }

  emitChatMessage(lobbyId: string, payload: unknown, options?: { userIds?: string[] }): void {
    void this.publishWs(
      {
        type: 'chat_message',
        lobbyId,
        payload,
      },
      options?.userIds,
    )
  }

  emitLobbyUpdated(lobbyId: string, payload: unknown): void {
    void this.publishWs({
      type: 'lobby_updated',
      lobbyId,
      payload,
    })
  }

  emitMatchUpdated(lobbyId: string, matchId: string, payload: unknown): void {
    void this.publishWs({
      type: 'match_updated',
      lobbyId,
      matchId,
      payload,
    })
  }

  emitMatchConnect(lobbyId: string, matchId: string, connect: MatchConnectInfo): void {
    void this.publishWs({
      type: 'match_connect',
      lobbyId,
      matchId,
      connect,
    })
  }

  emitTournamentUpdated(tournamentId: string, payload: unknown): void {
    void this.publishTournament(tournamentId, 'tournament_updated', payload)
  }

  private async publishWs(message: WsServerMessage, userIds?: string[]): Promise<void> {
    const envelope: WsBusEnvelope = { message, userIds }
    await redis.publish(RedisChannels.ws, JSON.stringify(envelope))
  }

  private async publishTournament(
    tournamentId: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
    const envelope: TournamentBusEnvelope = { tournamentId, type, payload }
    await redis.publish(RedisChannels.tournament, JSON.stringify(envelope))
  }

  private deliverLobbyLocal(message: WsServerMessage, userIds?: string[]): void {
    if (!('lobbyId' in message) || !message.lobbyId) return

    const room = this.lobbyRooms.get(message.lobbyId)
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

  private deliverTournamentLocal(envelope: TournamentBusEnvelope): void {
    const room = this.tournamentRooms.get(envelope.tournamentId)
    if (!room) return

    const message = JSON.stringify({
      type: 'tournament_updated',
      tournamentId: envelope.tournamentId,
      payload: envelope.payload,
    })

    for (const socket of room) {
      try {
        socket.send(message)
      } catch {
        // Socket may already be closing
      }
    }
  }
}

export const wsHub = new WebSocketHub()
