import { and, desc, eq } from 'drizzle-orm'
import { env } from '../config/env'
import { db } from '../db'
import {
  lobbies,
  matchPlayers,
  matches,
  tournamentMatches,
  users,
  type Match,
  type MatchEvent,
  type MatchStatus,
  type PlayerMatchStats,
} from '../db/schema'
import { ACTIVE_DUTY_MAPS, resolveDathostLocation } from '../lib/constants'
import { generateMatchPassword, generateRconPassword } from '../lib/crypto'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors'
import {
  acquireLock,
  claimOnce,
  RedisKeys,
  releaseLock,
  webhookClaimTtlSeconds,
} from '../lib/redis'
import { enqueueJob } from './redis/job-queue'
import type { AuthUser } from '../types/hono'
import { dathostClient, DathostApiError } from './dathost/client'
import type { DathostMatch } from './dathost/types'
import { lobbyService } from './lobby.service'
import { wsHub } from './websocket/hub'
import type { MatchConnectInfo } from './websocket/types'

export type MatchPlayerView = {
  id: string
  userId: string
  steamId64: string
  nickname: string
  team: 'unassigned' | 'team1' | 'team2' | 'spectator'
  connected: boolean
  kicked: boolean
  stats: PlayerMatchStats | null
}

export type MatchView = {
  id: string
  lobbyId: string
  status: MatchStatus
  map: string
  location: string
  team1Name: string
  team2Name: string
  team1Score: number
  team2Score: number
  cancelReason: string | null
  connect: MatchConnectInfo | null
  players: MatchPlayerView[]
  events: MatchEvent[]
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

export class MatchService {
  async launchFromLobby(user: AuthUser, lobbyId: string): Promise<MatchView> {
    const lockToken = await acquireLock(RedisKeys.lockLaunch(lobbyId), 90)
    if (!lockToken) {
      throw new ConflictError('Match launch already in progress for this lobby')
    }

    try {
      return await this.launchFromLobbyLocked(user, lobbyId)
    } finally {
      await releaseLock(RedisKeys.lockLaunch(lobbyId), lockToken)
    }
  }

  private async launchFromLobbyLocked(user: AuthUser, lobbyId: string): Promise<MatchView> {
    const lobby = await lobbyService.requireHostLobby(user.id, lobbyId)

    if (lobby.status === 'map_veto') {
      throw new ConflictError('Finish or cancel the map veto before launching')
    }

    if (lobby.status !== 'waiting' && lobby.status !== 'ready_check') {
      throw new ConflictError('Lobby cannot be launched in its current state')
    }

    let lobbyView = await lobbyService.getLobbyView(lobbyId)

    if (lobbyView.playerCount !== lobby.teamSize * 2) {
      throw new ConflictError(`Need exactly ${lobby.teamSize * 2} players to launch`)
    }

    const unassigned = lobbyView.players.filter((player) => player.team === 'unassigned')
    if (unassigned.length > 0) {
      lobbyView = await lobbyService.assignRandomTeams(lobbyId)
    }

    lobbyView = await lobbyService.getLobbyView(lobbyId)

    const teamPlayers = [...lobbyView.team1, ...lobbyView.team2]
    if (teamPlayers.some((player) => !player.isReady)) {
      throw new ConflictError('All players must be ready before launching')
    }

    if (lobbyView.team1.length !== lobby.teamSize || lobbyView.team2.length !== lobby.teamSize) {
      throw new ConflictError('Teams must be balanced before launch')
    }

    let selectedMap = lobby.map
    if (!selectedMap) {
      if (lobby.mapSelectionMode === 'captains_veto') {
        throw new ConflictError('Select a map manually or complete the map veto before launching')
      }
      selectedMap =
        lobby.mapPool[Math.floor(Math.random() * lobby.mapPool.length)] ?? ACTIVE_DUTY_MAPS[0]
    }

    if (!lobby.map) {
      await db
        .update(lobbies)
        .set({ map: selectedMap, updatedAt: new Date() })
        .where(eq(lobbies.id, lobbyId))
    }

    await db
      .update(lobbies)
      .set({ status: 'launching', updatedAt: new Date() })
      .where(eq(lobbies.id, lobbyId))

    wsHub.emitLobbyUpdated(lobbyId, await lobbyService.getLobbyView(lobbyId))

    const password = generateMatchPassword()
    const rcon = generateRconPassword()
    const location = resolveDathostLocation(lobby.location)
    const settings = lobby.matchSettings

    const fixture = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.lobbyId, lobbyId),
    })

    const [match] = await db
      .insert(matches)
      .values({
        lobbyId,
        tournamentMatchId: fixture?.id ?? null,
        status: 'provisioning',
        map: selectedMap,
        location: lobby.location,
        connectPassword: password,
        team1Name: lobby.team1Name,
        team2Name: lobby.team2Name,
      })
      .returning()

    if (fixture) {
      await db
        .update(tournamentMatches)
        .set({ status: 'live', updatedAt: new Date() })
        .where(eq(tournamentMatches.id, fixture.id))
    }

    const matchId = match!.id

    const participants = lobbyView.players.filter(
      (player) =>
        player.team === 'team1' || player.team === 'team2' || player.team === 'spectator',
    )

    for (const player of participants) {
      await db.insert(matchPlayers).values({
        matchId,
        userId: player.userId,
        steamId64: player.steamId64,
        team: player.team,
        nickname: player.username,
      })
    }

    let dathostServerId: string | null = null

    try {
      const server = await dathostClient.duplicateServer(env.DATHOST_TEMPLATE_SERVER_ID, {
        location,
      })
      dathostServerId = server.id

      await dathostClient.updateServer(server.id, {
        name: `fragstack-${matchId.slice(0, 8)}`,
        location,
        'cs2_settings.slots': String(lobby.teamSize * 2 + Math.max(1, lobbyView.spectatorCount)),
        'cs2_settings.rcon': rcon,
        user_data: matchId,
        autostop: 'true',
        autostop_minutes: '10',
      })

      await db
        .update(matches)
        .set({
          dathostServerId: server.id,
          status: 'booting',
        })
        .where(eq(matches.id, matchId))

      const dathostMatch = await dathostClient.createMatch({
        game_server_id: server.id,
        players: participants.map((player) => ({
          steam_id_64: player.steamId64,
          team: player.team as 'team1' | 'team2' | 'spectator',
          nickname_override: player.username,
        })),
        team1: { name: lobby.team1Name },
        team2: { name: lobby.team2Name },
        settings: {
          map: selectedMap,
          password,
          connect_time: settings.connectTime,
          match_begin_countdown: settings.matchBeginCountdown,
          team_size: lobby.teamSize,
          wait_for_gotv: settings.waitForGotv,
          enable_plugin: settings.enablePlugin,
          enable_tech_pause: settings.enableTechPause,
        },
        webhooks: {
          event_url: `${env.PUBLIC_URL}/webhooks/dathost`,
          enabled_events: ['*'],
          authorization_header: env.DATHOST_WEBHOOK_SECRET,
        },
      })

      await db
        .update(matches)
        .set({
          dathostMatchId: dathostMatch.id,
          status: 'booting',
        })
        .where(eq(matches.id, matchId))

      const view = await this.getMatchView(matchId)
      wsHub.emitMatchUpdated(lobbyId, matchId, view)
      return view
    } catch (error) {
      await db
        .update(matches)
        .set({
          status: 'canceled',
          cancelReason: error instanceof Error ? error.message : 'Launch failed',
          finishedAt: new Date(),
        })
        .where(eq(matches.id, matchId))

      await db
        .update(lobbies)
        .set({ status: 'waiting', updatedAt: new Date() })
        .where(eq(lobbies.id, lobbyId))

      if (dathostServerId) {
        try {
          await dathostClient.deleteServer(dathostServerId)
        } catch {
          // Best-effort teardown
        }
      }

      wsHub.emitLobbyUpdated(lobbyId, await lobbyService.getLobbyView(lobbyId))

      if (error instanceof DathostApiError) {
        throw new ConflictError(`DatHost error: ${error.body ?? error.message}`)
      }

      throw error
    }
  }

  async cancelMatch(user: AuthUser, matchId: string): Promise<MatchView> {
    const match = await this.requireMatch(matchId)
    const lobby = await lobbyService.requireLobby(match.lobbyId)

    if (lobby.hostUserId !== user.id) {
      throw new ForbiddenError('Only the lobby host can cancel the match')
    }

    if (match.status === 'finished' || match.status === 'canceled') {
      throw new ConflictError('Match is already closed')
    }

    if (match.dathostMatchId) {
      try {
        await dathostClient.cancelMatch(match.dathostMatchId)
      } catch {
        // Continue with local cancel + teardown
      }
    }

    await this.finalizeMatch(match, 'canceled', 'USER_API_CANCEL')
    return this.getMatchView(matchId)
  }

  async handleWebhook(authorizationHeader: string | undefined, payload: DathostMatch): Promise<void> {
    if (authorizationHeader !== env.DATHOST_WEBHOOK_SECRET) {
      throw new ForbiddenError('Invalid webhook authorization')
    }

    if (!payload.id) {
      throw new BadRequestError('Invalid webhook payload')
    }

    const latestEvent = payload.events?.[payload.events.length - 1]
    const eventName = latestEvent?.event
    const eventIndex = Math.max(0, (payload.events?.length ?? 1) - 1)
    const fingerprint = `${eventName ?? 'unknown'}:${latestEvent?.timestamp ?? 0}:${eventIndex}:${payload.rounds_played ?? 0}:${payload.finished ? 1 : 0}`
    const claimed = await claimOnce(
      RedisKeys.webhookDathost(payload.id, fingerprint),
      webhookClaimTtlSeconds(eventName),
    )
    if (!claimed) {
      return
    }

    const match = await db.query.matches.findFirst({
      where: eq(matches.dathostMatchId, payload.id),
    })

    if (!match) {
      // Ignore unknown matches (e.g. manual tests)
      return
    }

    const nextStatus = this.mapWebhookStatus(payload, eventName)
    const connect = await this.maybeResolveConnect(match, eventName)

    await db
      .update(matches)
      .set({
        status: nextStatus,
        team1Score: payload.team1.stats?.score ?? match.team1Score,
        team2Score: payload.team2.stats?.score ?? match.team2Score,
        cancelReason: payload.cancel_reason,
        events: payload.events ?? match.events,
        connectIp: connect?.ip ?? match.connectIp,
        connectPort: connect?.port ?? match.connectPort,
        startedAt:
          eventName === 'match_started' && !match.startedAt ? new Date() : match.startedAt,
        finishedAt:
          nextStatus === 'finished' || nextStatus === 'canceled' ? new Date() : match.finishedAt,
      })
      .where(eq(matches.id, match.id))

    if (payload.players?.length) {
      for (const player of payload.players) {
        await db
          .update(matchPlayers)
          .set({
            connected: player.connected ? 1 : 0,
            kicked: player.kicked ? 1 : 0,
            stats: player.stats
              ? {
                  kills: player.stats.kills,
                  assists: player.stats.assists,
                  deaths: player.stats.deaths,
                  mvps: player.stats.mvps,
                  score: player.stats.score,
                  headshots: player.stats.kills_with_headshot,
                  damageDealt: player.stats.damage_dealt,
                }
              : null,
          })
          .where(
            and(
              eq(matchPlayers.matchId, match.id),
              eq(matchPlayers.steamId64, player.steam_id_64),
            ),
          )
      }
    }

    if (eventName === 'server_ready_for_players' && connect) {
      wsHub.emitMatchConnect(match.lobbyId, match.id, connect)
      void enqueueJob({ type: 'load_fragstack_config', matchId: match.id })
    }

    if (eventName === 'match_ended' || eventName === 'gotv_stopped' || eventName === 'match_canceled') {
      if (match.dathostServerId) {
        void enqueueJob({
          type: 'teardown_dathost',
          serverId: match.dathostServerId,
          matchId: match.id,
        })
      }
      await db
        .update(lobbies)
        .set({
          status: eventName === 'match_canceled' ? 'waiting' : 'closed',
          updatedAt: new Date(),
        })
        .where(eq(lobbies.id, match.lobbyId))
    }

    if (eventName === 'match_started') {
      await db
        .update(lobbies)
        .set({ status: 'in_match', updatedAt: new Date() })
        .where(eq(lobbies.id, match.lobbyId))
    }

    if (
      (eventName === 'match_ended' || eventName === 'gotv_stopped') &&
      nextStatus === 'finished' &&
      match.tournamentMatchId
    ) {
      const { tournamentService } = await import('./tournament.service')
      await tournamentService.onMatchFinished(match.tournamentMatchId, {
        team1: payload.team1.stats?.score ?? match.team1Score,
        team2: payload.team2.stats?.score ?? match.team2Score,
      })
    }

    const view = await this.getMatchView(match.id)
    wsHub.emitMatchUpdated(match.lobbyId, match.id, view)
    wsHub.emitLobbyUpdated(match.lobbyId, await lobbyService.getLobbyView(match.lobbyId))
  }

  async getMatchView(matchId: string): Promise<MatchView> {
    const match = await this.requireMatch(matchId)

    const players = await db
      .select({
        player: matchPlayers,
        username: users.username,
      })
      .from(matchPlayers)
      .innerJoin(users, eq(matchPlayers.userId, users.id))
      .where(eq(matchPlayers.matchId, matchId))

    return {
      id: match.id,
      lobbyId: match.lobbyId,
      status: match.status,
      map: match.map,
      location: match.location,
      team1Name: match.team1Name,
      team2Name: match.team2Name,
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      cancelReason: match.cancelReason,
      connect: this.buildConnectInfo(match),
      players: players.map(({ player }) => ({
        id: player.id,
        userId: player.userId,
        steamId64: player.steamId64,
        nickname: player.nickname,
        team: player.team,
        connected: player.connected === 1,
        kicked: player.kicked === 1,
        stats: player.stats,
      })),
      events: match.events,
      createdAt: match.createdAt,
      startedAt: match.startedAt,
      finishedAt: match.finishedAt,
    }
  }

  async getLatestMatchForLobby(lobbyId: string): Promise<MatchView | null> {
    const match = await db.query.matches.findFirst({
      where: eq(matches.lobbyId, lobbyId),
      orderBy: [desc(matches.createdAt)],
    })

    if (!match) return null
    return this.getMatchView(match.id)
  }

  private async finalizeMatch(
    match: Match,
    status: 'finished' | 'canceled',
    cancelReason?: string,
  ): Promise<void> {
    await db
      .update(matches)
      .set({
        status,
        cancelReason: cancelReason ?? match.cancelReason,
        finishedAt: new Date(),
      })
      .where(eq(matches.id, match.id))

    await this.teardownServer(match)

    await db
      .update(lobbies)
      .set({
        status: status === 'canceled' ? 'waiting' : 'closed',
        updatedAt: new Date(),
      })
      .where(eq(lobbies.id, match.lobbyId))

    const view = await this.getMatchView(match.id)
    wsHub.emitMatchUpdated(match.lobbyId, match.id, view)
    wsHub.emitLobbyUpdated(match.lobbyId, await lobbyService.getLobbyView(match.lobbyId))
  }

  private async teardownServer(match: Match): Promise<void> {
    if (!match.dathostServerId) return
    void enqueueJob({
      type: 'teardown_dathost',
      serverId: match.dathostServerId,
      matchId: match.id,
    })
  }

  /** Job worker: load match JSON into Fragstack on the game server. */
  async runLoadFragstackConfigJob(matchId: string): Promise<void> {
    const match = await this.requireMatch(matchId)
    if (!match.dathostServerId) {
      throw new Error(`Match ${matchId} has no DatHost server`)
    }

    const base = env.PUBLIC_URL.replace(/\/$/, '')
    const url = `${base}/matches/${matchId}/fragstack.json`
    const line = `fragstack_loadmatch_url "${url}" "Authorization" "${env.DATHOST_WEBHOOK_SECRET}"`
    await dathostClient.sendConsole(match.dathostServerId, line)
  }

  /** Job worker: delete ephemeral DatHost server. */
  async runTeardownServerJob(serverId: string): Promise<void> {
    await dathostClient.deleteServer(serverId)
  }

  private async maybeResolveConnect(
    match: Match,
    eventName: string | undefined,
  ): Promise<MatchConnectInfo | null> {
    if (eventName !== 'server_ready_for_players' && match.connectIp && match.connectPort) {
      return this.buildConnectInfo(match)
    }

    if (!match.dathostServerId) return null

    try {
      const server = await dathostClient.getServer(match.dathostServerId)
      const ip = server.raw_ip || server.ip
      const port = server.ports?.game

      if (!ip || !port) return null

      await db
        .update(matches)
        .set({
          connectIp: ip,
          connectPort: port,
          status: 'waiting_players',
        })
        .where(eq(matches.id, match.id))

      return {
        ip,
        port,
        password: match.connectPassword ?? '',
        connectString: `connect ${ip}:${port}${match.connectPassword ? `; password ${match.connectPassword}` : ''}`,
      }
    } catch {
      return null
    }
  }

  private buildConnectInfo(match: Match): MatchConnectInfo | null {
    if (!match.connectIp || !match.connectPort) return null

    return {
      ip: match.connectIp,
      port: match.connectPort,
      password: match.connectPassword ?? '',
      connectString: `connect ${match.connectIp}:${match.connectPort}${
        match.connectPassword ? `; password ${match.connectPassword}` : ''
      }`,
    }
  }

  private mapWebhookStatus(payload: DathostMatch, eventName?: string): MatchStatus {
    if (payload.cancel_reason || eventName === 'match_canceled') return 'canceled'
    if (payload.finished || eventName === 'match_ended' || eventName === 'gotv_stopped') {
      return 'finished'
    }
    if (eventName === 'match_started') return 'live'
    if (eventName === 'server_ready_for_players' || eventName === 'all_players_connected') {
      return 'waiting_players'
    }
    if (eventName === 'booting_server' || eventName === 'loading_map') return 'booting'
    return 'booting'
  }

  private async requireMatch(matchId: string): Promise<Match> {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    })

    if (!match) throw new NotFoundError('Match not found')
    return match
  }
}

export const matchService = new MatchService()
