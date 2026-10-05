import type { LobbyAction } from '../lobby.service'

export type WsClientMessage =
  | { type: 'subscribe'; lobbyId: string }
  | { type: 'unsubscribe'; lobbyId: string }
  | { type: 'subscribe_tournament'; tournamentId: string }
  | { type: 'unsubscribe_tournament'; tournamentId: string }
  | { type: 'ping' }
  | { type: 'lobby_action'; lobbyId: string; action: LobbyAction }

export type WsServerMessage =
  | { type: 'pong' }
  | { type: 'subscribed'; lobbyId: string }
  | { type: 'subscribed_tournament'; tournamentId: string }
  | { type: 'error'; message: string }
  | { type: 'lobby_updated'; lobbyId: string; payload: unknown }
  | { type: 'chat_message'; lobbyId: string; payload: unknown }
  | { type: 'match_updated'; lobbyId: string; matchId: string; payload: unknown }
  | { type: 'match_connect'; lobbyId: string; matchId: string; connect: MatchConnectInfo }
  | { type: 'tournament_updated'; tournamentId: string; payload: unknown }
  | { type: 'action_ok'; lobbyType: string }

export type MatchConnectInfo = {
  ip: string
  port: number
  password: string
  connectString: string
}

export type WsSessionData = {
  userId: string | null
  subscribedLobbyIds: Set<string>
  subscribedTournamentIds: Set<string>
}
