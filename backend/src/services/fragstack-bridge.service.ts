import { eq } from 'drizzle-orm'
import { db } from '../db'
import { lobbies, lobbyPlayers, matches, users } from '../db/schema'
import { env } from '../config/env'
import { ForbiddenError, NotFoundError } from '../lib/errors'
import {
  claimOnce,
  RedisKeys,
  webhookClaimTtlSeconds,
} from '../lib/redis'
import type { LobbyMatchSettings } from '../db/schema'
import { lobbyService } from './lobby.service'
import { wsHub } from './websocket/hub'

export type FragstackJson = {
  matchid: string
  num_maps: number
  players_per_team: number
  skip_veto: boolean
  side_type: 'always_knife' | 'never_knife' | 'standard' | 'random'
  maplist: string[]
  team1: { name: string; players: Record<string, string> }
  team2: { name: string; players: Record<string, string> }
  spectators: { players: Record<string, string> }
  clinch_series: boolean
  cvars: Record<string, string>
  settings: LobbyMatchSettings
  fragstack: {
    match_id: string
    lobby_id: string
    tournament_match_id: string | null
    dathost_match_id: string | null
  }
}

function settingsToCvars(settings: LobbyMatchSettings): Record<string, string> {
  const cvars: Record<string, string> = {
    mp_maxrounds: String(settings.maxRounds),
    mp_overtime_enable: settings.overtime ? '1' : '0',
    mp_startmoney: String(settings.startMoney),
    mp_maxmoney: String(settings.maxMoney),
    mp_overtime_startmoney: String(settings.overtimeMoney),
    mp_freezetime: String(settings.freezeTime),
    fragstack_enable_tech_pause: settings.enableTechPause ? 'true' : 'false',
  }

  if (settings.voiceChat === 'allies_only') {
    cvars.sv_alltalk = '0'
    cvars.sv_deadtalk = '0'
    cvars.sv_talk_enemy_living = '0'
    cvars.sv_talk_enemy_dead = '0'
  } else {
    cvars.sv_alltalk = '1'
  }

  if (settings.armor === 'kevlar') cvars.mp_free_armor = '1'
  if (settings.armor === 'kevlar_helmet') cvars.mp_free_armor = '2'
  if (settings.headshotOnly) cvars.mp_damage_headshot_only = '1'

  return cvars
}

export class FragstackBridgeService {
  async getMatchConfig(matchId: string): Promise<FragstackJson> {
    const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) })
    if (!match) throw new NotFoundError('Match not found')

    const lobby = await db.query.lobbies.findFirst({ where: eq(lobbies.id, match.lobbyId) })
    if (!lobby) throw new NotFoundError('Lobby not found')

    const roster = await db
      .select({
        steamId64: users.steamId64,
        username: users.username,
        team: lobbyPlayers.team,
      })
      .from(lobbyPlayers)
      .innerJoin(users, eq(lobbyPlayers.userId, users.id))
      .where(eq(lobbyPlayers.lobbyId, lobby.id))

    const team1Players: Record<string, string> = {}
    const team2Players: Record<string, string> = {}
    const spectators: Record<string, string> = {}

    for (const row of roster) {
      if (row.team === 'team1') team1Players[row.steamId64] = row.username
      else if (row.team === 'team2') team2Players[row.steamId64] = row.username
      else if (row.team === 'spectator') spectators[row.steamId64] = row.username
    }

    const settings = lobby.matchSettings
    const map = match.map || lobby.map || lobby.mapPool[0] || 'de_mirage'

    return {
      matchid: match.id,
      num_maps: 1,
      players_per_team: lobby.teamSize,
      skip_veto: true,
      side_type: settings.knifeRound ? 'always_knife' : 'never_knife',
      maplist: [map],
      team1: { name: match.team1Name, players: team1Players },
      team2: { name: match.team2Name, players: team2Players },
      spectators: { players: spectators },
      clinch_series: true,
      cvars: {
        ...settingsToCvars(settings),
        hostname: `Fragstack | ${match.team1Name} vs ${match.team2Name}`,
        fragstack_remote_log_url: `${env.PUBLIC_URL.replace(/\/$/, '')}/webhooks/fragstack`,
        fragstack_remote_log_header_key: 'Authorization',
        fragstack_remote_log_header_value: env.DATHOST_WEBHOOK_SECRET,
      },
      settings,
      fragstack: {
        match_id: match.id,
        lobby_id: lobby.id,
        tournament_match_id: match.tournamentMatchId,
        dathost_match_id: match.dathostMatchId,
      },
    }
  }

  async handleEvent(
    authorizationHeader: string | undefined,
    body: {
      event?: string
      matchid?: string
      team1_score?: number
      team2_score?: number
      map?: string
      tournament_match_id?: string | null
      source?: string
    },
  ): Promise<void> {
    if (authorizationHeader !== env.DATHOST_WEBHOOK_SECRET) {
      throw new ForbiddenError('Invalid Fragstack webhook authorization')
    }

    if (!body.event || !body.matchid) return

    const fingerprint = `${body.event}:${body.map ?? ''}:${body.team1_score ?? ''}:${body.team2_score ?? ''}:${body.tournament_match_id ?? ''}`
    const claimed = await claimOnce(
      RedisKeys.webhookFragstack(body.matchid, fingerprint),
      webhookClaimTtlSeconds(body.event),
    )
    if (!claimed) return

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, body.matchid),
    })
    if (!match) {
      return
    }

    if (body.event === 'match_started') {
      await db
        .update(matches)
        .set({ status: 'live', startedAt: match.startedAt ?? new Date() })
        .where(eq(matches.id, match.id))
      await db
        .update(lobbies)
        .set({ status: 'in_match', updatedAt: new Date() })
        .where(eq(lobbies.id, match.lobbyId))
    } else if (body.event === 'match_ended' || body.event === 'series_end') {
      const score1 = body.team1_score ?? match.team1Score
      const score2 = body.team2_score ?? match.team2Score
      await db
        .update(matches)
        .set({
          status: 'finished',
          team1Score: score1,
          team2Score: score2,
          finishedAt: new Date(),
        })
        .where(eq(matches.id, match.id))

      await db
        .update(lobbies)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(lobbies.id, match.lobbyId))

      if (match.tournamentMatchId) {
        const { tournamentService } = await import('./tournament.service')
        await tournamentService.onMatchFinished(match.tournamentMatchId, {
          team1: score1,
          team2: score2,
        })
      }
    } else if (body.event === 'match_canceled') {
      await db
        .update(matches)
        .set({
          status: 'canceled',
          cancelReason: 'FRAGSTACK_CANCEL',
          finishedAt: new Date(),
        })
        .where(eq(matches.id, match.id))
      await db
        .update(lobbies)
        .set({ status: 'waiting', updatedAt: new Date() })
        .where(eq(lobbies.id, match.lobbyId))
    } else if (
      body.event === 'round_end' &&
      body.team1_score != null &&
      body.team2_score != null
    ) {
      await db
        .update(matches)
        .set({ team1Score: body.team1_score, team2Score: body.team2_score })
        .where(eq(matches.id, match.id))
    } else {
      return
    }

    const { matchService } = await import('./match.service')
    const view = await matchService.getMatchView(match.id)
    wsHub.emitMatchUpdated(match.lobbyId, match.id, view)
    wsHub.emitLobbyUpdated(match.lobbyId, await lobbyService.getLobbyView(match.lobbyId))
  }
}

export const fragstackBridgeService = new FragstackBridgeService()
