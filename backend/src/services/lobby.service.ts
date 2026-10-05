import { createHash } from 'node:crypto'
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import { env } from '../config/env'
import { db } from '../db'
import {
  DEFAULT_MATCH_SETTINGS,
  DEFAULT_READY_CHECK,
  DEFAULT_VETO_STATE,
  lobbies,
  lobbyChatMessages,
  lobbyPlayers,
  users,
  type Lobby,
  type LobbyMatchSettings,
  type LobbyPlayer,
  type LobbyTeam,
  type ReadyCheckState,
  type VetoState,
} from '../db/schema'
import { ACTIVE_DUTY_MAPS, LOBBY_SOLO_INACTIVITY_SECONDS, READY_CHECK_SECONDS } from '../lib/constants'
import { generateLobbyCode } from '../lib/crypto'
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors'
import {
  createLobbySchema,
  lobbySettingsPatchSchema,
  mergeMatchSettings,
  type CreateLobbyInput,
  type LobbySettingsPatch,
} from '../lib/lobby-settings'
import {
  pushChatMessageCache,
  rateLimit,
  redis,
  RedisKeys,
} from '../lib/redis'
import type { AuthUser } from '../types/hono'
import { readyCheckScheduler } from './redis/ready-check'
import { soloInactivityScheduler } from './redis/solo-inactivity'
import { wsHub } from './websocket/hub'

export { createLobbySchema, lobbySettingsPatchSchema }
export type { CreateLobbyInput, LobbySettingsPatch }

const PLAYING_TEAMS: LobbyTeam[] = ['team1', 'team2']
const MAX_SPECTATORS = 20
const MAX_CHAT_MESSAGE_LENGTH = 500

export type LobbyPlayerView = {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  steamId64: string
  team: LobbyTeam
  isReady: boolean
  isCaptain: boolean
  isAdmin: boolean
  joinedAt: Date
}

export type ChatMessageView = {
  id: string
  lobbyId: string
  userId: string
  username: string
  avatarUrl: string | null
  channel: 'general' | 'team'
  team: 'team1' | 'team2' | null
  message: string
  createdAt: Date
}

export type LobbyView = {
  id: string
  code: string
  shareUrl: string
  hostUserId: string
  status: Lobby['status']
  teamSize: number
  bestOf: number
  location: string
  locationSelectionMode: string
  map: string | null
  mapPool: string[]
  mapSelectionMode: string
  startMode: string
  privacy: string
  hasPassword: boolean
  team1Name: string
  team2Name: string
  allowJoinTeam: boolean
  matchSettings: LobbyMatchSettings
  veto: VetoState
  readyCheck: ReadyCheckState
  isPublic: boolean
  playerCount: number
  spectatorCount: number
  maxPlayers: number
  players: LobbyPlayerView[]
  spectators: LobbyPlayerView[]
  unassigned: LobbyPlayerView[]
  team1: LobbyPlayerView[]
  team2: LobbyPlayerView[]
  createdAt: Date
  updatedAt: Date
}

export type LobbyAction =
  | { type: 'set_settings'; settings: LobbySettingsPatch }
  | { type: 'set_team'; team: LobbyTeam }
  | { type: 'set_player_team'; userId: string; team: LobbyTeam }
  | { type: 'swap'; userIdA: string; userIdB: string }
  | { type: 'set_captain'; userId: string; team: 'team1' | 'team2' }
  | { type: 'clear_captain'; team: 'team1' | 'team2' }
  | { type: 'scramble' }
  | { type: 'set_ready'; isReady: boolean }
  | { type: 'set_map'; map: string | null }
  | { type: 'start_veto' }
  | { type: 'cancel_veto' }
  | { type: 'ban_map'; map: string }
  | { type: 'chat'; message: string; channel?: 'general' | 'team' }
  | { type: 'request_launch' }
  | { type: 'leave' }
  | { type: 'reset_settings' }
  | { type: 'apply_template'; templateId: string }

function isPlayingTeam(team: LobbyTeam): team is 'team1' | 'team2' {
  return team === 'team1' || team === 'team2'
}

function hashLobbyPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

class ReadyTimerRegistry {
  clear(lobbyId: string) {
    void readyCheckScheduler.clear(lobbyId)
  }

  start(lobbyId: string, _onExpire: () => void) {
    void readyCheckScheduler.schedule(lobbyId)
  }
}

const readyTimers = new ReadyTimerRegistry()

export class LobbyService {
  async createLobby(host: AuthUser, input: CreateLobbyInput): Promise<LobbyView> {
    const rl = await rateLimit(RedisKeys.rateLimitCreateLobby(host.id), 5, 60)
    if (!rl.allowed) {
      throw new BadRequestError('Too many lobbies created — try again in a minute')
    }

    await this.ensureUserNotInActiveLobby(host.id)

    if (input.privacy === 'password' && !input.lobbyPassword) {
      throw new BadRequestError('Password is required for password-protected lobbies')
    }

    const code = await this.allocateUniqueCode()
    const [lobby] = await db
      .insert(lobbies)
      .values({
        code,
        hostUserId: host.id,
        teamSize: input.teamSize,
        bestOf: input.bestOf,
        location: input.location,
        locationSelectionMode: input.locationSelectionMode,
        mapPool: [...ACTIVE_DUTY_MAPS],
        mapSelectionMode: input.mapSelectionMode,
        startMode: input.startMode,
        privacy: input.privacy,
        lobbyPasswordHash:
          input.privacy === 'password' && input.lobbyPassword
            ? hashLobbyPassword(input.lobbyPassword)
            : null,
        team1Name: input.team1Name,
        team2Name: input.team2Name,
        allowJoinTeam: input.allowJoinTeam,
        matchSettings: DEFAULT_MATCH_SETTINGS,
        veto: DEFAULT_VETO_STATE,
        readyCheck: DEFAULT_READY_CHECK,
      })
      .returning()

    await db.insert(lobbyPlayers).values({
      lobbyId: lobby!.id,
      userId: host.id,
      team: 'unassigned',
      isReady: false,
      isCaptain: false,
    })

    return this.broadcastLobby(lobby!.id)
  }

  async createLobbyForTournamentMatch(
    host: AuthUser,
    input: {
      teamSize: number
      bestOf: number
      location: string
      locationSelectionMode: 'host' | 'captains_ban' | 'players_vote'
      mapSelectionMode: 'host' | 'captains_veto' | 'players_vote'
      startMode: 'by_host' | 'when_ready'
      mapPool: string[]
      matchSettings: LobbyMatchSettings
      team1Name: string
      team2Name: string
      team1Roster: { userId: string; steamId64: string; username: string }[]
      team2Roster: { userId: string; steamId64: string; username: string }[]
    },
  ): Promise<Lobby> {
    const code = await this.allocateUniqueCode()
    const [lobby] = await db
      .insert(lobbies)
      .values({
        code,
        hostUserId: host.id,
        teamSize: input.teamSize as 1 | 2 | 3 | 5,
        bestOf: input.bestOf as 1 | 3 | 5,
        location: input.location,
        locationSelectionMode: input.locationSelectionMode,
        mapPool: input.mapPool.length ? [...input.mapPool] : [...ACTIVE_DUTY_MAPS],
        mapSelectionMode: input.mapSelectionMode,
        startMode: input.startMode,
        privacy: 'private',
        lobbyPasswordHash: null,
        team1Name: input.team1Name,
        team2Name: input.team2Name,
        allowJoinTeam: false,
        matchSettings: input.matchSettings,
        veto: DEFAULT_VETO_STATE,
        readyCheck: DEFAULT_READY_CHECK,
      })
      .returning()

    const lobbyId = lobby!.id
    let captain1 = true
    let captain2 = true

    for (const player of input.team1Roster) {
      await this.insertTournamentLobbyPlayer(lobbyId, player.userId, 'team1', captain1)
      captain1 = false
    }
    for (const player of input.team2Roster) {
      await this.insertTournamentLobbyPlayer(lobbyId, player.userId, 'team2', captain2)
      captain2 = false
    }

    if (!input.team1Roster.some((p) => p.userId === host.id) && !input.team2Roster.some((p) => p.userId === host.id)) {
      await db.insert(lobbyPlayers).values({
        lobbyId,
        userId: host.id,
        team: 'spectator',
        isReady: false,
        isCaptain: false,
      })
    }

    await this.broadcastLobby(lobbyId)
    return lobby!
  }

  private async insertTournamentLobbyPlayer(
    lobbyId: string,
    userId: string,
    team: 'team1' | 'team2',
    isCaptain: boolean,
  ): Promise<void> {
    const existing = await db.query.lobbyPlayers.findFirst({
      where: and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.userId, userId)),
    })
    if (existing) return

    const otherLobby = await db
      .select({ lobbyId: lobbyPlayers.lobbyId })
      .from(lobbyPlayers)
      .innerJoin(lobbies, eq(lobbyPlayers.lobbyId, lobbies.id))
      .where(and(eq(lobbyPlayers.userId, userId), ne(lobbies.status, 'closed')))

    for (const row of otherLobby) {
      await db
        .delete(lobbyPlayers)
        .where(and(eq(lobbyPlayers.lobbyId, row.lobbyId), eq(lobbyPlayers.userId, userId)))
    }

    await db.insert(lobbyPlayers).values({
      lobbyId,
      userId,
      team,
      isReady: true,
      isCaptain,
    })
  }

  async joinLobby(
    user: AuthUser,
    code: string,
    options: { asSpectator?: boolean; password?: string } = {},
  ): Promise<LobbyView> {
    const rl = await rateLimit(RedisKeys.rateLimitJoinLobby(user.id), 20, 60)
    if (!rl.allowed) {
      throw new BadRequestError('Too many join attempts — slow down')
    }

    const lobby = await db.query.lobbies.findFirst({
      where: eq(lobbies.code, code.toUpperCase()),
    })

    if (!lobby || lobby.status === 'closed') {
      throw new NotFoundError('Lobby not found')
    }

    if (lobby.status === 'launching' || lobby.status === 'in_match') {
      throw new ConflictError('Lobby is no longer joinable')
    }

    if (lobby.privacy === 'password') {
      if (!options.password || !lobby.lobbyPasswordHash) {
        throw new ForbiddenError('Lobby password required')
      }
      if (hashLobbyPassword(options.password) !== lobby.lobbyPasswordHash) {
        throw new ForbiddenError('Invalid lobby password')
      }
    }

    const existing = await db.query.lobbyPlayers.findFirst({
      where: and(eq(lobbyPlayers.lobbyId, lobby.id), eq(lobbyPlayers.userId, user.id)),
    })
    if (existing) return this.getLobbyView(lobby.id)

    await this.ensureUserNotInActiveLobby(user.id)

    if (options.asSpectator) {
      await this.ensureSpectatorSlot(lobby.id)
      await db.insert(lobbyPlayers).values({
        lobbyId: lobby.id,
        userId: user.id,
        team: 'spectator',
        isReady: false,
        isCaptain: false,
      })
    } else {
      await this.ensurePlayingSlot(lobby)
      await db.insert(lobbyPlayers).values({
        lobbyId: lobby.id,
        userId: user.id,
        team: 'unassigned',
        isReady: false,
        isCaptain: false,
      })
    }

    return this.broadcastLobby(lobby.id)
  }

  async handleAction(user: AuthUser, lobbyId: string, action: LobbyAction): Promise<LobbyView | null> {
    switch (action.type) {
      case 'set_settings':
        return this.updateSettings(user, lobbyId, action.settings)
      case 'set_team':
        return this.setOwnTeam(user, lobbyId, action.team)
      case 'set_player_team':
        return this.setPlayerTeam(user, lobbyId, action.userId, action.team)
      case 'swap':
        return this.swapPlayers(user, lobbyId, action.userIdA, action.userIdB)
      case 'set_captain':
        return this.setCaptain(user, lobbyId, action.userId, action.team)
      case 'clear_captain':
        return this.clearCaptain(user, lobbyId, action.team)
      case 'scramble':
        return this.scrambleTeams(user, lobbyId)
      case 'set_ready':
        return this.setReady(user, lobbyId, action.isReady)
      case 'set_map':
        return this.setMapManual(user, lobbyId, action.map)
      case 'start_veto':
        return this.startMapVeto(user, lobbyId)
      case 'cancel_veto':
        return this.cancelMapVeto(user, lobbyId)
      case 'ban_map':
        return this.banMap(user, lobbyId, action.map)
      case 'chat':
        await this.sendChatMessage(user, lobbyId, action.message, action.channel ?? 'general')
        return this.getLobbyView(lobbyId)
      case 'request_launch':
        await this.requestLaunch(user, lobbyId)
        return this.getLobbyView(lobbyId)
      case 'leave':
        await this.leaveLobby(user, lobbyId)
        return null
      case 'reset_settings':
        return this.resetSettings(user, lobbyId)
      case 'apply_template':
        return this.applyTemplate(user, lobbyId, action.templateId)
      default:
        throw new BadRequestError('Unknown lobby action')
    }
  }

  async updateSettings(admin: AuthUser, lobbyId: string, input: LobbySettingsPatch): Promise<LobbyView> {
    const lobby = await this.requireAdmin(admin.id, lobbyId)
    this.assertConfigurable(lobby)

    if (lobby.status === 'map_veto' && (input.mapPool || input.mapSelectionMode || input.map !== undefined)) {
      throw new ConflictError('Cannot change map settings during an active veto')
    }

    const nextPrivacy = input.privacy ?? lobby.privacy
    let passwordHash = lobby.lobbyPasswordHash
    if (input.lobbyPassword === null || nextPrivacy !== 'password') {
      if (nextPrivacy !== 'password') passwordHash = null
    }
    if (typeof input.lobbyPassword === 'string') {
      passwordHash = hashLobbyPassword(input.lobbyPassword)
    }
    if (nextPrivacy === 'password' && !passwordHash) {
      throw new BadRequestError('Password is required for password-protected lobbies')
    }

    const nextMapPool = input.mapPool ?? lobby.mapPool
    if (input.map && !nextMapPool.includes(input.map)) {
      throw new BadRequestError('Map is not in the lobby map pool')
    }

    const nextMatchSettings = mergeMatchSettings(
      { ...DEFAULT_MATCH_SETTINGS, ...lobby.matchSettings },
      input.matchSettings,
    )

    await db
      .update(lobbies)
      .set({
        teamSize: input.teamSize ?? lobby.teamSize,
        bestOf: input.bestOf ?? lobby.bestOf,
        location: input.location ?? lobby.location,
        locationSelectionMode: input.locationSelectionMode ?? lobby.locationSelectionMode,
        mapPool: nextMapPool,
        map: input.map === undefined ? lobby.map : input.map,
        mapSelectionMode: input.mapSelectionMode ?? lobby.mapSelectionMode,
        startMode: input.startMode ?? lobby.startMode,
        privacy: nextPrivacy,
        lobbyPasswordHash: passwordHash,
        allowJoinTeam: input.allowJoinTeam ?? lobby.allowJoinTeam,
        team1Name: input.team1Name ?? lobby.team1Name,
        team2Name: input.team2Name ?? lobby.team2Name,
        matchSettings: nextMatchSettings,
        updatedAt: new Date(),
      })
      .where(eq(lobbies.id, lobbyId))

    if (input.startMode && input.startMode !== 'when_ready') {
      await this.clearReadyCheck(lobbyId)
    }

    return this.broadcastLobby(lobbyId)
  }

  async resetSettings(admin: AuthUser, lobbyId: string): Promise<LobbyView> {
    await this.requireAdmin(admin.id, lobbyId)
    return this.updateSettings(admin, lobbyId, {
      teamSize: 5,
      bestOf: 1,
      location: 'stockholm',
      locationSelectionMode: 'host',
      mapSelectionMode: 'host',
      startMode: 'by_host',
      privacy: 'public',
      lobbyPassword: null,
      allowJoinTeam: true,
      map: null,
      mapPool: [...ACTIVE_DUTY_MAPS],
      matchSettings: DEFAULT_MATCH_SETTINGS,
    })
  }

  async applyTemplate(admin: AuthUser, lobbyId: string, templateId: string): Promise<LobbyView> {
    const { templateService } = await import('./template.service')
    const template = await templateService.getOwned(admin.id, templateId)
    const settings = lobbySettingsPatchSchema.parse({
      ...template.settings,
      lobbyPassword: null,
    })
    return this.updateSettings(admin, lobbyId, settings)
  }

  async setOwnTeam(user: AuthUser, lobbyId: string, team: LobbyTeam): Promise<LobbyView> {
    const lobby = await this.requireLobby(lobbyId)
    this.assertTeamEditable(lobby)

    if (!lobby.allowJoinTeam && team !== 'spectator') {
      throw new ForbiddenError('Joining teams is disabled by the host')
    }

    const membership = await this.requireMembership(lobbyId, user.id)
    await this.movePlayerToTeam(lobby, membership, team)
    await this.clearReadyCheck(lobbyId)
    return this.broadcastLobby(lobbyId)
  }

  async setPlayerTeam(
    admin: AuthUser,
    lobbyId: string,
    targetUserId: string,
    team: LobbyTeam,
  ): Promise<LobbyView> {
    const lobby = await this.requireAdmin(admin.id, lobbyId)
    this.assertTeamEditable(lobby)
    const membership = await this.requireMembership(lobbyId, targetUserId)
    await this.movePlayerToTeam(lobby, membership, team)
    await this.clearReadyCheck(lobbyId)
    return this.broadcastLobby(lobbyId)
  }

  async swapPlayers(
    admin: AuthUser,
    lobbyId: string,
    userIdA: string,
    userIdB: string,
  ): Promise<LobbyView> {
    const lobby = await this.requireAdmin(admin.id, lobbyId)
    this.assertTeamEditable(lobby)
    if (userIdA === userIdB) throw new BadRequestError('Cannot swap a player with themselves')

    const playerA = await this.requireMembership(lobbyId, userIdA)
    const playerB = await this.requireMembership(lobbyId, userIdB)

    await db
      .update(lobbyPlayers)
      .set({ team: playerB.team, isCaptain: playerB.isCaptain, isReady: false })
      .where(eq(lobbyPlayers.id, playerA.id))
    await db
      .update(lobbyPlayers)
      .set({ team: playerA.team, isCaptain: playerA.isCaptain, isReady: false })
      .where(eq(lobbyPlayers.id, playerB.id))

    await this.clearReadyCheck(lobbyId)
    return this.broadcastLobby(lobbyId)
  }

  async setCaptain(
    admin: AuthUser,
    lobbyId: string,
    userId: string,
    team: 'team1' | 'team2',
  ): Promise<LobbyView> {
    await this.requireAdmin(admin.id, lobbyId)
    const membership = await this.requireMembership(lobbyId, userId)
    if (membership.team !== team) {
      throw new BadRequestError('Player must be on the team before becoming captain')
    }

    await db
      .update(lobbyPlayers)
      .set({ isCaptain: false })
      .where(and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.team, team)))
    await db.update(lobbyPlayers).set({ isCaptain: true }).where(eq(lobbyPlayers.id, membership.id))
    return this.broadcastLobby(lobbyId)
  }

  async clearCaptain(admin: AuthUser, lobbyId: string, team: 'team1' | 'team2'): Promise<LobbyView> {
    await this.requireAdmin(admin.id, lobbyId)
    await db
      .update(lobbyPlayers)
      .set({ isCaptain: false })
      .where(and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.team, team)))
    return this.broadcastLobby(lobbyId)
  }

  async scrambleTeams(admin: AuthUser, lobbyId: string): Promise<LobbyView> {
    const lobby = await this.requireAdmin(admin.id, lobbyId)
    this.assertTeamEditable(lobby)

    const players = await db.query.lobbyPlayers.findMany({
      where: and(
        eq(lobbyPlayers.lobbyId, lobbyId),
        inArray(lobbyPlayers.team, ['unassigned', 'team1', 'team2']),
      ),
    })

    if (players.length !== lobby.teamSize * 2) {
      throw new ConflictError(`Need exactly ${lobby.teamSize * 2} non-spectator players to scramble`)
    }

    const shuffled = [...players].sort(() => Math.random() - 0.5)
    for (let index = 0; index < shuffled.length; index++) {
      const player = shuffled[index]!
      const team: LobbyTeam = index < lobby.teamSize ? 'team1' : 'team2'
      await db
        .update(lobbyPlayers)
        .set({ team, isCaptain: false, isReady: false })
        .where(eq(lobbyPlayers.id, player.id))
    }

    await this.clearReadyCheck(lobbyId)
    return this.broadcastLobby(lobbyId)
  }

  async assignRandomTeams(lobbyId: string): Promise<LobbyView> {
    const lobby = await this.requireLobby(lobbyId)
    const players = await db.query.lobbyPlayers.findMany({
      where: and(
        eq(lobbyPlayers.lobbyId, lobbyId),
        inArray(lobbyPlayers.team, ['unassigned', 'team1', 'team2']),
      ),
    })

    if (players.length !== lobby.teamSize * 2) {
      throw new ConflictError(`Lobby needs exactly ${lobby.teamSize * 2} players`)
    }

    const shuffled = [...players].sort(() => Math.random() - 0.5)
    for (let index = 0; index < shuffled.length; index++) {
      const player = shuffled[index]!
      const team: LobbyTeam = index < lobby.teamSize ? 'team1' : 'team2'
      await db
        .update(lobbyPlayers)
        .set({ team, isReady: false })
        .where(eq(lobbyPlayers.id, player.id))
    }

    return this.getLobbyView(lobbyId)
  }

  async setReady(user: AuthUser, lobbyId: string, isReady: boolean): Promise<LobbyView> {
    const lobby = await this.requireLobby(lobbyId)
    if (lobby.status === 'launching' || lobby.status === 'in_match' || lobby.status === 'map_veto') {
      throw new ConflictError('Cannot change ready state now')
    }

    const membership = await this.requireMembership(lobbyId, user.id)
    if (!isPlayingTeam(membership.team)) {
      throw new BadRequestError('Only players on a team can ready up')
    }

    await db.update(lobbyPlayers).set({ isReady }).where(eq(lobbyPlayers.id, membership.id))

    if (lobby.startMode === 'when_ready') {
      await this.syncWhenReadyFlow(lobbyId)
    }

    return this.broadcastLobby(lobbyId)
  }

  async setMapManual(admin: AuthUser, lobbyId: string, map: string | null): Promise<LobbyView> {
    const lobby = await this.requireAdmin(admin.id, lobbyId)
    this.assertConfigurable(lobby)
    if (lobby.mapSelectionMode !== 'host' && map) {
      throw new ConflictError('Host map selection is disabled for this lobby')
    }
    if (map && !lobby.mapPool.includes(map)) {
      throw new BadRequestError('Map is not in the lobby map pool')
    }

    await db
      .update(lobbies)
      .set({ map, veto: DEFAULT_VETO_STATE, updatedAt: new Date() })
      .where(eq(lobbies.id, lobbyId))

    return this.broadcastLobby(lobbyId)
  }

  async startMapVeto(admin: AuthUser, lobbyId: string): Promise<LobbyView> {
    const lobby = await this.requireAdmin(admin.id, lobbyId)
    this.assertConfigurable(lobby)
    if (lobby.mapSelectionMode !== 'captains_veto') {
      throw new ConflictError('Captain veto is not enabled for this lobby')
    }
    if (lobby.mapPool.length < 2) {
      throw new BadRequestError('Map pool must contain at least 2 maps for a veto')
    }

    await this.requireBothCaptains(lobbyId)
    const startingTeam: 'team1' | 'team2' = Math.random() < 0.5 ? 'team1' : 'team2'
    const veto: VetoState = {
      status: 'in_progress',
      remainingMaps: [...lobby.mapPool],
      bannedMaps: [],
      turnTeam: startingTeam,
      selectedMap: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    }

    await db
      .update(lobbies)
      .set({ status: 'map_veto', map: null, veto, updatedAt: new Date() })
      .where(eq(lobbies.id, lobbyId))

    return this.broadcastLobby(lobbyId)
  }

  async cancelMapVeto(admin: AuthUser, lobbyId: string): Promise<LobbyView> {
    await this.requireAdmin(admin.id, lobbyId)
    readyTimers.clear(lobbyId)
    await db
      .update(lobbies)
      .set({
        status: 'waiting',
        veto: DEFAULT_VETO_STATE,
        readyCheck: DEFAULT_READY_CHECK,
        updatedAt: new Date(),
      })
      .where(eq(lobbies.id, lobbyId))
    return this.broadcastLobby(lobbyId)
  }

  async banMap(user: AuthUser, lobbyId: string, map: string): Promise<LobbyView> {
    const lobby = await this.requireLobby(lobbyId)
    if (lobby.status !== 'map_veto' || lobby.veto.status !== 'in_progress') {
      throw new ConflictError('No map veto is in progress')
    }

    const membership = await this.requireMembership(lobbyId, user.id)
    if (!membership.isCaptain || !isPlayingTeam(membership.team)) {
      throw new ForbiddenError('Only team captains can ban maps')
    }
    if (lobby.veto.turnTeam !== membership.team) {
      throw new ForbiddenError('It is not your turn to ban')
    }
    if (!lobby.veto.remainingMaps.includes(map)) {
      throw new BadRequestError('Map is not available in the current veto')
    }

    const remainingMaps = lobby.veto.remainingMaps.filter((item) => item !== map)
    const bannedMaps = [
      ...lobby.veto.bannedMaps,
      { map, team: membership.team, byUserId: user.id, at: new Date().toISOString() },
    ]

    if (remainingMaps.length === 1) {
      const selectedMap = remainingMaps[0]!
      await db
        .update(lobbies)
        .set({
          status: 'waiting',
          map: selectedMap,
          veto: {
            status: 'completed',
            remainingMaps,
            bannedMaps,
            turnTeam: null,
            selectedMap,
            startedAt: lobby.veto.startedAt,
            completedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(lobbies.id, lobbyId))
    } else {
      await db
        .update(lobbies)
        .set({
          veto: {
            ...lobby.veto,
            remainingMaps,
            bannedMaps,
            turnTeam: membership.team === 'team1' ? 'team2' : 'team1',
          },
          updatedAt: new Date(),
        })
        .where(eq(lobbies.id, lobbyId))
    }

    return this.broadcastLobby(lobbyId)
  }

  async requestLaunch(user: AuthUser, lobbyId: string): Promise<void> {
    const lobby = await this.requireLobby(lobbyId)

    if (lobby.startMode === 'by_host') {
      await this.requireAdmin(user.id, lobbyId)
      const { matchService } = await import('./match.service')
      await matchService.launchFromLobby(user, lobbyId)
      return
    }

    if (!lobby.readyCheck.active) {
      await this.startReadyCheck(lobbyId)
      await this.broadcastLobby(lobbyId)
      return
    }

    throw new ConflictError('Ready check already in progress')
  }

  async leaveLobby(user: AuthUser, lobbyId: string): Promise<void> {
    const lobby = await this.requireLobby(lobbyId)
    if (lobby.status === 'launching' || lobby.status === 'in_match') {
      throw new ConflictError('Cannot leave lobby during an active match')
    }

    const membership = await this.requireMembership(lobbyId, user.id)
    await db.delete(lobbyPlayers).where(eq(lobbyPlayers.id, membership.id))

    const remaining = await db.query.lobbyPlayers.findMany({
      where: eq(lobbyPlayers.lobbyId, lobbyId),
    })

    if (remaining.length === 0) {
      readyTimers.clear(lobbyId)
      await soloInactivityScheduler.clear(lobbyId)
      await db
        .update(lobbies)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(lobbies.id, lobbyId))
      wsHub.emitLobbyUpdated(lobbyId, { id: lobbyId, status: 'closed' })
      void redis.del(RedisKeys.publicLobbies)
      return
    }

    if (lobby.hostUserId === user.id) {
      const nextAdmin =
        remaining.find((player) => isPlayingTeam(player.team)) ?? remaining[0]!
      await db
        .update(lobbies)
        .set({ hostUserId: nextAdmin.userId, updatedAt: new Date() })
        .where(eq(lobbies.id, lobbyId))
    }

    await this.clearReadyCheck(lobbyId)
    await this.broadcastLobby(lobbyId)
  }

  async sendChatMessage(
    user: AuthUser,
    lobbyId: string,
    message: string,
    channel: 'general' | 'team' = 'general',
  ): Promise<ChatMessageView> {
    const rl = await rateLimit(RedisKeys.rateLimitChat(user.id), 20, 10)
    if (!rl.allowed) {
      throw new BadRequestError('Too many messages — slow down')
    }

    await this.requireLobby(lobbyId)
    const membership = await this.requireMembership(lobbyId, user.id)

    const trimmed = message.trim()
    if (!trimmed) throw new BadRequestError('Message cannot be empty')
    if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new BadRequestError(`Message cannot exceed ${MAX_CHAT_MESSAGE_LENGTH} characters`)
    }

    let team: 'team1' | 'team2' | null = null
    if (channel === 'team') {
      if (membership.team !== 'team1' && membership.team !== 'team2') {
        throw new BadRequestError('Join a team to use team chat')
      }
      team = membership.team
    }

    const [row] = await db
      .insert(lobbyChatMessages)
      .values({
        lobbyId,
        userId: user.id,
        channel,
        team,
        message: trimmed,
      })
      .returning()

    const view: ChatMessageView = {
      id: row!.id,
      lobbyId,
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      channel,
      team,
      message: trimmed,
      createdAt: row!.createdAt,
    }

    if (channel === 'team' && team) {
      const teammates = await db.query.lobbyPlayers.findMany({
        where: and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.team, team)),
      })
      wsHub.emitChatMessage(
        lobbyId,
        view,
        { userIds: teammates.map((player) => player.userId) },
      )
    } else {
      wsHub.emitChatMessage(lobbyId, view)
    }

    void pushChatMessageCache(lobbyId, view)
    void this.touchSoloInactivityIfNeeded(lobbyId)

    return view
  }

  async getChatHistory(
    lobbyId: string,
    options: { userId?: string | null; limit?: number } = {},
  ): Promise<ChatMessageView[]> {
    await this.requireLobby(lobbyId)
    const limit = Math.min(options.limit ?? 100, 200)

    let viewerTeam: 'team1' | 'team2' | null = null
    if (options.userId) {
      const membership = await db.query.lobbyPlayers.findFirst({
        where: and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.userId, options.userId)),
      })
      if (membership?.team === 'team1' || membership?.team === 'team2') {
        viewerTeam = membership.team
      }
    }

    const cachedRows = await redis.lrange(RedisKeys.chatRecent(lobbyId), 0, limit * 2 - 1)
    if (cachedRows.length > 0) {
      const parsed = cachedRows
        .map((row) => {
          try {
            return JSON.parse(row) as ChatMessageView
          } catch {
            return null
          }
        })
        .filter((m): m is ChatMessageView => m != null)

      const filtered = parsed
        .filter((message) => {
          if (message.channel !== 'team') return true
          return Boolean(viewerTeam && message.team === viewerTeam)
        })
        .slice(0, limit)
        .reverse()

      if (filtered.length >= Math.min(limit, 20)) {
        return filtered
      }
    }

    const rows = await db
      .select({ message: lobbyChatMessages, user: users })
      .from(lobbyChatMessages)
      .innerJoin(users, eq(lobbyChatMessages.userId, users.id))
      .where(eq(lobbyChatMessages.lobbyId, lobbyId))
      .orderBy(desc(lobbyChatMessages.createdAt))
      .limit(limit * 2)

    return rows
      .map(({ message, user }) => ({
        id: message.id,
        lobbyId: message.lobbyId,
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        channel: (message.channel === 'team' ? 'team' : 'general') as 'general' | 'team',
        team:
          message.team === 'team1' || message.team === 'team2'
            ? (message.team as 'team1' | 'team2')
            : null,
        message: message.message,
        createdAt: message.createdAt,
      }))
      .filter((message) => {
        if (message.channel !== 'team') return true
        return Boolean(viewerTeam && message.team === viewerTeam)
      })
      .slice(0, limit)
      .reverse()
  }

  async listPublicLobbies(): Promise<LobbyView[]> {
    const cached = await redis.get(RedisKeys.publicLobbies)
    if (cached) {
      try {
        return JSON.parse(cached) as LobbyView[]
      } catch {
        // fall through
      }
    }

    const rows = await db.query.lobbies.findMany({
      where: and(eq(lobbies.privacy, 'public'), ne(lobbies.status, 'closed')),
      orderBy: [desc(lobbies.createdAt)],
      limit: 50,
    })
    const views = await Promise.all(rows.map((lobby) => this.getLobbyView(lobby.id)))
    await redis.set(RedisKeys.publicLobbies, JSON.stringify(views), 'EX', 3)
    return views
  }

  async getLobbyByCode(code: string): Promise<LobbyView> {
    const lobby = await db.query.lobbies.findFirst({
      where: eq(lobbies.code, code.toUpperCase()),
    })
    if (!lobby || lobby.status === 'closed') throw new NotFoundError('Lobby not found')
    return this.getLobbyView(lobby.id)
  }

  async getLobbyView(lobbyId: string, _options?: { skipCache?: boolean }): Promise<LobbyView> {
    // No Redis cache here: remote Redis RTT (~400ms+) is slower than Postgres for this hot path.
    return this.buildLobbyViewUncached(lobbyId)
  }

  private async buildLobbyViewUncached(lobbyId: string): Promise<LobbyView> {
    const lobby = await this.requireLobby(lobbyId)
    const rows = await db
      .select({ player: lobbyPlayers, user: users })
      .from(lobbyPlayers)
      .innerJoin(users, eq(lobbyPlayers.userId, users.id))
      .where(eq(lobbyPlayers.lobbyId, lobbyId))
      .orderBy(asc(lobbyPlayers.joinedAt))

    const members: LobbyPlayerView[] = rows.map(({ player, user }) => ({
      id: player.id,
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      steamId64: user.steamId64,
      team: player.team,
      isReady: player.isReady,
      isCaptain: player.isCaptain,
      isAdmin: lobby.hostUserId === user.id,
      joinedAt: player.joinedAt,
    }))

    const team1 = members.filter((player) => player.team === 'team1')
    const team2 = members.filter((player) => player.team === 'team2')
    const spectators = members.filter((player) => player.team === 'spectator')
    const unassigned = members.filter((player) => player.team === 'unassigned')

    return {
      id: lobby.id,
      code: lobby.code,
      shareUrl: `${env.FRONTEND_URL}/lobby/${lobby.code}`,
      hostUserId: lobby.hostUserId,
      status: lobby.status,
      teamSize: lobby.teamSize,
      bestOf: lobby.bestOf,
      location: lobby.location,
      locationSelectionMode: lobby.locationSelectionMode,
      map: lobby.map,
      mapPool: lobby.mapPool,
      mapSelectionMode: lobby.mapSelectionMode,
      startMode: lobby.startMode,
      privacy: lobby.privacy,
      hasPassword: Boolean(lobby.lobbyPasswordHash),
      team1Name: lobby.team1Name,
      team2Name: lobby.team2Name,
      allowJoinTeam: lobby.allowJoinTeam,
      matchSettings: { ...DEFAULT_MATCH_SETTINGS, ...lobby.matchSettings },
      veto: lobby.veto,
      readyCheck: lobby.readyCheck,
      isPublic: lobby.privacy === 'public',
      playerCount: team1.length + team2.length + unassigned.length,
      spectatorCount: spectators.length,
      maxPlayers: lobby.teamSize * 2,
      players: members,
      spectators,
      unassigned,
      team1,
      team2,
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
    }
  }

  async requireLobby(lobbyId: string): Promise<Lobby> {
    const lobby = await db.query.lobbies.findFirst({ where: eq(lobbies.id, lobbyId) })
    if (!lobby) throw new NotFoundError('Lobby not found')
    return lobby
  }

  async requireHostLobby(userId: string, lobbyId: string): Promise<Lobby> {
    return this.requireAdmin(userId, lobbyId)
  }

  private async syncWhenReadyFlow(lobbyId: string): Promise<void> {
    const lobby = await this.requireLobby(lobbyId)
    if (!lobby.readyCheck.active) return

    const view = await this.getLobbyView(lobbyId)
    const playing = [...view.team1, ...view.team2]

    if (playing.length !== lobby.teamSize * 2) return

    if (playing.every((player) => player.isReady)) {
      readyTimers.clear(lobbyId)
      const host = await db.query.users.findFirst({ where: eq(users.id, lobby.hostUserId) })
      if (!host) return
      const authUser: AuthUser = {
        id: host.id,
        steamId64: host.steamId64,
        username: host.username,
        avatarUrl: host.avatarUrl,
        profileUrl: host.profileUrl,
      }
      const { matchService } = await import('./match.service')
      await matchService.launchFromLobby(authUser, lobbyId)
    }
  }

  private async startReadyCheck(lobbyId: string): Promise<void> {
    const lobby = await this.requireLobby(lobbyId)
    const view = await this.getLobbyView(lobbyId)
    if (view.team1.length !== lobby.teamSize || view.team2.length !== lobby.teamSize) {
      throw new ConflictError('Teams must be full before starting the ready check')
    }

    await db
      .update(lobbyPlayers)
      .set({ isReady: false })
      .where(and(eq(lobbyPlayers.lobbyId, lobbyId), inArray(lobbyPlayers.team, PLAYING_TEAMS)))

    const endsAt = new Date(Date.now() + READY_CHECK_SECONDS * 1000)
    await db
      .update(lobbies)
      .set({
        status: 'ready_check',
        readyCheck: { active: true, endsAt: endsAt.toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(lobbies.id, lobbyId))

    await readyCheckScheduler.clear(lobbyId)
    await readyCheckScheduler.schedule(lobbyId, endsAt.getTime())
  }

  /** Called by the Redis ready-check worker (any instance may win the lock). */
  async handleReadyCheckExpired(lobbyId: string): Promise<void> {
    await this.onReadyCheckExpired(lobbyId)
  }

  /** Called when a solo lobby has been idle for LOBBY_SOLO_INACTIVITY_SECONDS. */
  async handleSoloInactivityExpired(lobbyId: string): Promise<void> {
    const lobby = await db.query.lobbies.findFirst({ where: eq(lobbies.id, lobbyId) })
    if (!lobby || lobby.status === 'closed') return
    if (lobby.status === 'launching' || lobby.status === 'in_match') {
      await soloInactivityScheduler.clear(lobbyId)
      return
    }

    const players = await db.query.lobbyPlayers.findMany({
      where: eq(lobbyPlayers.lobbyId, lobbyId),
    })
    if (players.length !== 1) {
      // Not solo anymore — reschedule or clear based on current state
      if (players.length === 0) {
        await soloInactivityScheduler.clear(lobbyId)
        return
      }
      await soloInactivityScheduler.clear(lobbyId)
      return
    }

    readyTimers.clear(lobbyId)
    await soloInactivityScheduler.clear(lobbyId)
    await db
      .update(lobbies)
      .set({
        status: 'closed',
        readyCheck: DEFAULT_READY_CHECK,
        updatedAt: new Date(),
      })
      .where(eq(lobbies.id, lobbyId))

    await redis.del(RedisKeys.publicLobbies)
    wsHub.emitLobbyUpdated(lobbyId, {
      id: lobbyId,
      status: 'closed',
      cancelReason: 'INACTIVITY',
    })
  }

  private async onReadyCheckExpired(lobbyId: string): Promise<void> {
    const lobby = await db.query.lobbies.findFirst({ where: eq(lobbies.id, lobbyId) })
    if (!lobby || !lobby.readyCheck.active) return

    await db
      .update(lobbyPlayers)
      .set({ isReady: false })
      .where(and(eq(lobbyPlayers.lobbyId, lobbyId), inArray(lobbyPlayers.team, PLAYING_TEAMS)))

    await db
      .update(lobbies)
      .set({
        status: 'waiting',
        readyCheck: DEFAULT_READY_CHECK,
        updatedAt: new Date(),
      })
      .where(eq(lobbies.id, lobbyId))

    await this.broadcastLobby(lobbyId)
  }

  private async clearReadyCheck(lobbyId: string): Promise<void> {
    readyTimers.clear(lobbyId)
    await db
      .update(lobbyPlayers)
      .set({ isReady: false })
      .where(eq(lobbyPlayers.lobbyId, lobbyId))
    await db
      .update(lobbies)
      .set({
        status: 'waiting',
        readyCheck: DEFAULT_READY_CHECK,
        updatedAt: new Date(),
      })
      .where(eq(lobbies.id, lobbyId))
  }

  private async requireAdmin(userId: string, lobbyId: string): Promise<Lobby> {
    const lobby = await this.requireLobby(lobbyId)
    if (lobby.hostUserId !== userId) {
      throw new ForbiddenError('Only the lobby admin can perform this action')
    }
    return lobby
  }

  private async requireMembership(lobbyId: string, userId: string): Promise<LobbyPlayer> {
    const membership = await db.query.lobbyPlayers.findFirst({
      where: and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.userId, userId)),
    })
    if (!membership) throw new ForbiddenError('You are not in this lobby')
    return membership
  }

  private async requireBothCaptains(lobbyId: string) {
    const captains = await db.query.lobbyPlayers.findMany({
      where: and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.isCaptain, true)),
    })
    const team1Captain = captains.find((captain) => captain.team === 'team1')
    const team2Captain = captains.find((captain) => captain.team === 'team2')
    if (!team1Captain || !team2Captain) {
      throw new ConflictError('Both teams need a captain before starting map veto')
    }
  }

  private assertConfigurable(lobby: Lobby): void {
    if (lobby.status !== 'waiting' && lobby.status !== 'ready_check' && lobby.status !== 'map_veto') {
      throw new ConflictError('Lobby cannot be configured in its current state')
    }
  }

  private assertTeamEditable(lobby: Lobby): void {
    if (lobby.status === 'map_veto') throw new ConflictError('Cannot change teams during map veto')
    if (lobby.status !== 'waiting' && lobby.status !== 'ready_check') {
      throw new ConflictError('Cannot change teams now')
    }
  }

  private async movePlayerToTeam(
    lobby: Lobby,
    membership: LobbyPlayer,
    team: LobbyTeam,
  ): Promise<void> {
    if (team === membership.team) return

    if (team === 'spectator') {
      await this.ensureSpectatorSlot(lobby.id, membership.userId)
    } else if (isPlayingTeam(team)) {
      const teammates = await db.query.lobbyPlayers.findMany({
        where: and(eq(lobbyPlayers.lobbyId, lobby.id), eq(lobbyPlayers.team, team)),
      })
      if (teammates.filter((player) => player.userId !== membership.userId).length >= lobby.teamSize) {
        throw new ConflictError('Team is full')
      }
    } else if (team === 'unassigned') {
      const playing = await this.countPlayingMembers(lobby.id, membership.userId)
      if (playing >= lobby.teamSize * 2) throw new ConflictError('Lobby is full')
    } else {
      throw new BadRequestError('Invalid team')
    }

    await db
      .update(lobbyPlayers)
      .set({ team, isReady: false, isCaptain: false })
      .where(eq(lobbyPlayers.id, membership.id))
  }

  private async ensurePlayingSlot(lobby: Lobby, excludeUserId?: string): Promise<void> {
    if ((await this.countPlayingMembers(lobby.id, excludeUserId)) >= lobby.teamSize * 2) {
      throw new ConflictError('Lobby is full')
    }
  }

  private async ensureSpectatorSlot(lobbyId: string, excludeUserId?: string): Promise<void> {
    const spectators = await db.query.lobbyPlayers.findMany({
      where: and(eq(lobbyPlayers.lobbyId, lobbyId), eq(lobbyPlayers.team, 'spectator')),
    })
    if (spectators.filter((player) => player.userId !== excludeUserId).length >= MAX_SPECTATORS) {
      throw new ConflictError('Spectator slots are full')
    }
  }

  private async countPlayingMembers(lobbyId: string, excludeUserId?: string): Promise<number> {
    const players = await db.query.lobbyPlayers.findMany({
      where: and(
        eq(lobbyPlayers.lobbyId, lobbyId),
        inArray(lobbyPlayers.team, ['unassigned', 'team1', 'team2']),
      ),
    })
    return players.filter((player) => player.userId !== excludeUserId).length
  }

  private async ensureUserNotInActiveLobby(userId: string): Promise<void> {
    const memberships = await db
      .select({ lobbyId: lobbyPlayers.lobbyId })
      .from(lobbyPlayers)
      .innerJoin(lobbies, eq(lobbyPlayers.lobbyId, lobbies.id))
      .where(and(eq(lobbyPlayers.userId, userId), ne(lobbies.status, 'closed')))
    if (memberships.length > 0) throw new ConflictError('You are already in another lobby')
  }

  private async allocateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateLobbyCode()
      const existing = await db.query.lobbies.findFirst({ where: eq(lobbies.code, code) })
      if (!existing) return code
    }
    throw new Error('Failed to allocate lobby code')
  }

  private async touchSoloInactivityIfNeeded(lobbyId: string): Promise<void> {
    const lobby = await db.query.lobbies.findFirst({ where: eq(lobbies.id, lobbyId) })
    if (!lobby || lobby.status === 'closed' || lobby.status === 'launching' || lobby.status === 'in_match') {
      await soloInactivityScheduler.clear(lobbyId)
      return
    }

    const players = await db.query.lobbyPlayers.findMany({
      where: eq(lobbyPlayers.lobbyId, lobbyId),
    })

    if (players.length === 1) {
      await soloInactivityScheduler.touch(
        lobbyId,
        Date.now() + LOBBY_SOLO_INACTIVITY_SECONDS * 1000,
      )
      return
    }

    await soloInactivityScheduler.clear(lobbyId)
  }

  private async broadcastLobby(lobbyId: string): Promise<LobbyView> {
    const view = await this.getLobbyView(lobbyId)
    // Push WS first — never wait on Redis before clients see the update.
    wsHub.emitLobbyUpdated(lobbyId, view)
    void redis.del(RedisKeys.publicLobbies)
    void this.touchSoloInactivityIfNeeded(lobbyId)
    return view
  }
}

export const lobbyService = new LobbyService()
