import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  DEFAULT_MATCH_SETTINGS,
  lobbies,
  teamMembers,
  teams,
  tournamentEntries,
  tournamentMatches,
  tournaments,
  users,
  type Tournament,
  type TournamentMatch,
  type TournamentSettings,
} from '../db/schema'
import { ACTIVE_DUTY_MAPS } from '../lib/constants'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors'
import { slugifyTitle } from '../lib/tournament-settings'
import type { AuthUser } from '../types/hono'
import {
  advanceWinner,
  computeSwissStandings,
  fixtureKey,
  generateBracket,
  pairSwissRound,
  type GeneratedFixture,
} from './bracket'
import { lobbyService } from './lobby.service'
import { teamService } from './team.service'

export type EntryView = {
  id: string
  teamId: string
  teamName: string
  teamTag: string | null
  logoUrl: string | null
  seed: number | null
  status: string
  registeredAt: Date
  members: {
    userId: string
    steamId64: string
    username: string
    avatarUrl: string | null
    role: string
  }[]
}

export type FixtureView = {
  id: string
  roundKey: string
  bracketSide: string | null
  position: number
  team1EntryId: string | null
  team2EntryId: string | null
  team1Name: string | null
  team2Name: string | null
  score1: number
  score2: number
  bestOf: number
  status: string
  scheduledAt: Date | null
  lobbyId: string | null
  lobbyCode: string | null
  winnerEntryId: string | null
  nextMatchId: string | null
  nextSlot: number | null
}

export type TournamentListItem = {
  id: string
  slug: string
  title: string
  description: string
  imageUrl: string | null
  status: string
  format: string
  teamSize: number
  maxTeams: number
  startsAt: Date | null
  entryCount: number
}

export type TournamentDetail = TournamentListItem & {
  organizerUserId: string
  checkInRequired: boolean
  registrationOpensAt: Date | null
  registrationClosesAt: Date | null
  settings: TournamentSettings
  entries: EntryView[]
  fixtures: FixtureView[]
  standings: ReturnType<typeof computeSwissStandings>
}

function defaultSettings(teamSize: number): TournamentSettings {
  return {
    bestOf: 1,
    location: 'stockholm',
    locationSelectionMode: 'host',
    mapSelectionMode: 'host',
    startMode: 'by_host',
    mapPool: [...ACTIVE_DUTY_MAPS],
    matchSettings: { ...DEFAULT_MATCH_SETTINGS },
    swissRounds: Math.ceil(Math.log2(Math.max(4, teamSize))),
  }
}

export class TournamentService {
  async list(): Promise<TournamentListItem[]> {
    const rows = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt))
    const counts = await db
      .select({
        tournamentId: tournamentEntries.tournamentId,
        count: sql<number>`count(*)::int`,
      })
      .from(tournamentEntries)
      .groupBy(tournamentEntries.tournamentId)

    const countMap = new Map(counts.map((c) => [c.tournamentId, c.count]))

    return rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description,
      imageUrl: t.imageUrl,
      status: t.status,
      format: t.format,
      teamSize: t.teamSize,
      maxTeams: t.maxTeams,
      startsAt: t.startsAt,
      entryCount: countMap.get(t.id) ?? 0,
    }))
  }

  async create(
    user: AuthUser,
    input: {
      title: string
      description?: string
      imageUrl?: string
      format: Tournament['format']
      teamSize?: number
      maxTeams?: number
      checkInRequired?: boolean
      registrationOpensAt?: string
      registrationClosesAt?: string
      startsAt?: string
      settings?: Partial<TournamentSettings>
    },
  ): Promise<TournamentDetail> {
    const slug = await this.allocateSlug(input.title)
    const teamSize = input.teamSize ?? 5
    const settings = { ...defaultSettings(teamSize), ...input.settings }

    const [row] = await db
      .insert(tournaments)
      .values({
        slug,
        title: input.title,
        description: input.description ?? '',
        imageUrl: input.imageUrl ?? null,
        organizerUserId: user.id,
        format: input.format,
        teamSize,
        maxTeams: input.maxTeams ?? 16,
        checkInRequired: input.checkInRequired ?? false,
        registrationOpensAt: input.registrationOpensAt ? new Date(input.registrationOpensAt) : null,
        registrationClosesAt: input.registrationClosesAt ? new Date(input.registrationClosesAt) : null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        settings,
      })
      .returning()

    return this.getById(row!.id)
  }

  async getBySlug(slug: string): Promise<TournamentDetail> {
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.slug, slug) })
    if (!t) throw new NotFoundError('Tournament not found')
    return this.getById(t.id)
  }

  async getById(id: string): Promise<TournamentDetail> {
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) })
    if (!t) throw new NotFoundError('Tournament not found')
    return this.buildDetail(t)
  }

  async update(user: AuthUser, id: string, patch: Record<string, unknown>): Promise<TournamentDetail> {
    await this.requireOrganizer(user.id, id)
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, id) })
    if (!t) throw new NotFoundError('Tournament not found')

    await db
      .update(tournaments)
      .set({
        title: (patch.title as string | undefined) ?? t.title,
        description: (patch.description as string | undefined) ?? t.description,
        imageUrl:
          patch.imageUrl !== undefined ? (patch.imageUrl as string | null) : t.imageUrl,
        teamSize: (patch.teamSize as number | undefined) ?? t.teamSize,
        maxTeams: (patch.maxTeams as number | undefined) ?? t.maxTeams,
        checkInRequired: (patch.checkInRequired as boolean | undefined) ?? t.checkInRequired,
        registrationOpensAt:
          patch.registrationOpensAt !== undefined
            ? patch.registrationOpensAt
              ? new Date(patch.registrationOpensAt as string)
              : null
            : t.registrationOpensAt,
        registrationClosesAt:
          patch.registrationClosesAt !== undefined
            ? patch.registrationClosesAt
              ? new Date(patch.registrationClosesAt as string)
              : null
            : t.registrationClosesAt,
        startsAt:
          patch.startsAt !== undefined
            ? patch.startsAt
              ? new Date(patch.startsAt as string)
              : null
            : t.startsAt,
        settings: patch.settings
          ? {
              ...t.settings,
              ...(patch.settings as TournamentSettings),
              matchSettings: {
                ...t.settings.matchSettings,
                ...((patch.settings as TournamentSettings).matchSettings ?? {}),
              },
            }
          : t.settings,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, id))

    return this.getById(id)
  }

  async setStatus(user: AuthUser, id: string, status: Tournament['status']): Promise<TournamentDetail> {
    await this.requireOrganizer(user.id, id)
    await db.update(tournaments).set({ status, updatedAt: new Date() }).where(eq(tournaments.id, id))
    return this.getById(id)
  }

  async registerEntry(user: AuthUser, tournamentId: string, teamId: string): Promise<TournamentDetail> {
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
    if (!t) throw new NotFoundError('Tournament not found')
    if (t.status !== 'registration' && t.status !== 'draft') {
      throw new ConflictError('Registration is closed')
    }

    const isCap = await teamService.isCaptain(user.id, teamId)
    if (!isCap) throw new ForbiddenError('Only the team captain can register')

    const count = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, tournamentId))
    if ((count[0]?.n ?? 0) >= t.maxTeams) {
      throw new ConflictError('Tournament is full')
    }

    const teamView = await teamService.getView(teamId)
    const players = teamView.members.filter((m) => m.role !== 'coach')
    if (players.length < t.teamSize) {
      throw new BadRequestError(`Team needs at least ${t.teamSize} players (excluding coaches)`)
    }

    const existing = await db.query.tournamentEntries.findFirst({
      where: and(
        eq(tournamentEntries.tournamentId, tournamentId),
        eq(tournamentEntries.teamId, teamId),
      ),
    })

    if (existing) {
      if (existing.status === 'withdrawn') {
        await db
          .update(tournamentEntries)
          .set({ status: 'accepted', registeredAt: new Date() })
          .where(eq(tournamentEntries.id, existing.id))
      }
      return this.getById(tournamentId)
    }

    await db.insert(tournamentEntries).values({
      tournamentId,
      teamId,
      status: 'accepted',
    })

    return this.getById(tournamentId)
  }

  async checkIn(user: AuthUser, tournamentId: string, entryId: string): Promise<TournamentDetail> {
    const entry = await db.query.tournamentEntries.findFirst({
      where: and(eq(tournamentEntries.id, entryId), eq(tournamentEntries.tournamentId, tournamentId)),
    })
    if (!entry) throw new NotFoundError('Entry not found')

    const isCap = await teamService.isCaptain(user.id, entry.teamId)
    if (!isCap) throw new ForbiddenError('Only the team captain can check in')

    await db
      .update(tournamentEntries)
      .set({ status: 'checked_in' })
      .where(eq(tournamentEntries.id, entryId))

    return this.getById(tournamentId)
  }

  async withdrawEntry(user: AuthUser, tournamentId: string, entryId: string): Promise<TournamentDetail> {
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
    if (!t) throw new NotFoundError('Tournament not found')
    if (t.status === 'live' || t.status === 'completed' || t.status === 'canceled') {
      throw new ConflictError('Cannot withdraw after the tournament has started')
    }

    const entry = await db.query.tournamentEntries.findFirst({
      where: and(eq(tournamentEntries.id, entryId), eq(tournamentEntries.tournamentId, tournamentId)),
    })
    if (!entry) throw new NotFoundError('Entry not found')

    const isCap = await teamService.isCaptain(user.id, entry.teamId)
    const isOrga = t.organizerUserId === user.id
    if (!isCap && !isOrga) {
      throw new ForbiddenError('Only the team captain or organizer can withdraw')
    }

    await db
      .update(tournamentEntries)
      .set({ status: 'withdrawn' })
      .where(eq(tournamentEntries.id, entryId))

    return this.getById(tournamentId)
  }

  async generateBracket(user: AuthUser, tournamentId: string, randomSeed = false): Promise<TournamentDetail> {
    await this.requireOrganizer(user.id, tournamentId)
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
    if (!t) throw new NotFoundError('Tournament not found')

    let entries = await db
      .select()
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.tournamentId, tournamentId),
          inArray(tournamentEntries.status, ['accepted', 'checked_in']),
        ),
      )
      .orderBy(asc(tournamentEntries.seed), asc(tournamentEntries.registeredAt))

    if (entries.length < 2) {
      throw new BadRequestError('Need at least 2 teams to generate a bracket')
    }

    if (randomSeed || entries.every((e) => e.seed == null)) {
      entries = [...entries].sort(() => Math.random() - 0.5)
      for (let i = 0; i < entries.length; i++) {
        await db
          .update(tournamentEntries)
          .set({ seed: i + 1 })
          .where(eq(tournamentEntries.id, entries[i]!.id))
      }
    }

    const entryIds = entries.map((e) => e.id)
    const generated = generateBracket(t.format, entryIds, {
      bestOf: t.settings.bestOf,
      roundRobinDouble: t.settings.roundRobinDouble,
      swissRounds: t.settings.swissRounds,
      randomSeed,
    })

    await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId))
    await this.insertFixtures(tournamentId, t.settings.bestOf, generated)

    await db
      .update(tournaments)
      .set({ status: 'live', updatedAt: new Date() })
      .where(eq(tournaments.id, tournamentId))

    await this.refreshFixtureReadyStates(tournamentId)

    return this.getById(tournamentId)
  }

  async patchFixture(
    user: AuthUser,
    tournamentId: string,
    matchId: string,
    patch: {
      scheduledAt?: string | null
      score1?: number
      score2?: number
      status?: TournamentMatch['status']
      winnerEntryId?: string | null
    },
  ): Promise<TournamentDetail> {
    await this.requireOrganizer(user.id, tournamentId)
    const fixture = await this.requireFixture(tournamentId, matchId)

    const score1 = patch.score1 ?? fixture.score1
    const score2 = patch.score2 ?? fixture.score2
    let winnerEntryId = patch.winnerEntryId
    if (winnerEntryId === undefined && patch.score1 !== undefined && patch.score2 !== undefined) {
      if (score1 > score2) winnerEntryId = fixture.team1EntryId
      else if (score2 > score1) winnerEntryId = fixture.team2EntryId
      else winnerEntryId = null
    }

    const status =
      patch.status ??
      (winnerEntryId && (patch.score1 !== undefined || patch.score2 !== undefined)
        ? 'completed'
        : fixture.status)

    await db
      .update(tournamentMatches)
      .set({
        scheduledAt:
          patch.scheduledAt !== undefined
            ? patch.scheduledAt
              ? new Date(patch.scheduledAt)
              : null
            : fixture.scheduledAt,
        score1,
        score2,
        status,
        winnerEntryId: winnerEntryId !== undefined ? winnerEntryId : fixture.winnerEntryId,
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, matchId))

    if (status === 'completed' && winnerEntryId) {
      await this.applyAdvance(tournamentId, matchId)
    }

    return this.getById(tournamentId)
  }

  async openLobby(user: AuthUser, tournamentId: string, matchId: string) {
    await this.requireOrganizer(user.id, tournamentId)
    const fixture = await this.requireFixture(tournamentId, matchId)
    if (!fixture.team1EntryId || !fixture.team2EntryId) {
      throw new ConflictError('Both teams must be assigned before opening a lobby')
    }

    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
    if (!t) throw new NotFoundError('Tournament not found')

    const entryRows = await db
      .select()
      .from(tournamentEntries)
      .where(inArray(tournamentEntries.id, [fixture.team1EntryId, fixture.team2EntryId]))

    const teamIds = entryRows.map((e) => e.teamId)
    const teamRows = await db.select().from(teams).where(inArray(teams.id, teamIds))
    const team1 = teamRows.find((tm) => tm.id === entryRows.find((e) => e.id === fixture.team1EntryId)?.teamId)
    const team2 = teamRows.find((tm) => tm.id === entryRows.find((e) => e.id === fixture.team2EntryId)?.teamId)

    const lobby = await lobbyService.createLobbyForTournamentMatch(user, {
      teamSize: t.teamSize,
      bestOf: 1,
      location: t.settings.location,
      locationSelectionMode: t.settings.locationSelectionMode,
      mapSelectionMode: t.settings.mapSelectionMode,
      startMode: t.settings.startMode,
      mapPool: t.settings.mapPool,
      matchSettings: t.settings.matchSettings,
      team1Name: team1?.name ?? 'Team 1',
      team2Name: team2?.name ?? 'Team 2',
      team1Roster: await this.rosterForTeam(team1!.id, t.teamSize),
      team2Roster: await this.rosterForTeam(team2!.id, t.teamSize),
    })

    await db
      .update(tournamentMatches)
      .set({
        lobbyId: lobby.id,
        status: 'lobby_open',
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, matchId))

    const lobbyView = await lobbyService.getLobbyView(lobby.id)
    return { tournament: await this.getById(tournamentId), lobby: lobbyView }
  }

  async onMatchFinished(
    tournamentMatchId: string,
    mapScore: { team1: number; team2: number },
  ): Promise<void> {
    const fixture = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.id, tournamentMatchId),
    })
    if (!fixture) return

    const mapsToWin = Math.ceil(fixture.bestOf / 2)
    let score1 = fixture.score1
    let score2 = fixture.score2

    if (mapScore.team1 > mapScore.team2) score1 += 1
    else if (mapScore.team2 > mapScore.team1) score2 += 1

    let winnerEntryId: string | null = null
    let status: TournamentMatch['status'] = fixture.status === 'lobby_open' ? 'live' : fixture.status

    if (score1 >= mapsToWin) winnerEntryId = fixture.team1EntryId
    else if (score2 >= mapsToWin) winnerEntryId = fixture.team2EntryId

    if (winnerEntryId) status = 'completed'

    await db
      .update(tournamentMatches)
      .set({
        score1,
        score2,
        winnerEntryId,
        status,
        updatedAt: new Date(),
      })
      .where(eq(tournamentMatches.id, tournamentMatchId))

    if (winnerEntryId) {
      await this.applyAdvance(fixture.tournamentId, tournamentMatchId)
      await this.maybeGenerateNextSwissRound(fixture.tournamentId)
    }
  }

  private async maybeGenerateNextSwissRound(tournamentId: string) {
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
    if (!t || t.format !== 'swiss') return

    const fixtures = await db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournamentId))

    const rounds = new Set(fixtures.map((f) => f.roundKey))
    const latest = [...rounds].sort().at(-1)
    if (!latest) return

    const latestFixtures = fixtures.filter((f) => f.roundKey === latest)
    if (!latestFixtures.every((f) => f.status === 'completed' || f.status === 'walkover')) return

    const maxRounds = t.settings.swissRounds ?? 3
    const currentRound = Number.parseInt(latest.replace('swiss-r', ''), 10)
    if (currentRound >= maxRounds) return

    const entries = await db
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, tournamentId))
    const entryIds = entries.map((e) => e.id)
    const standings = computeSwissStandings(
      entryIds,
      fixtures.map((f) => ({
        team1EntryId: f.team1EntryId,
        team2EntryId: f.team2EntryId,
        score1: f.score1,
        score2: f.score2,
      })),
    )

    const next = pairSwissRound(currentRound + 1, entryIds, standings)
    await this.insertFixtures(tournamentId, t.settings.bestOf, next)
    await this.refreshFixtureReadyStates(tournamentId)
  }

  private async applyAdvance(tournamentId: string, matchId: string) {
    const fixture = await db.query.tournamentMatches.findFirst({
      where: eq(tournamentMatches.id, matchId),
    })
    if (!fixture?.winnerEntryId) return

    const { win, lose } = advanceWinner(fixture)

    for (const patch of [win, lose]) {
      if (!patch) continue
      const target = await db.query.tournamentMatches.findFirst({
        where: eq(tournamentMatches.id, patch.nextMatchId),
      })
      if (!target) continue

      const update =
        patch.slot === 1
          ? { team1EntryId: patch.entryId }
          : { team2EntryId: patch.entryId }

      await db
        .update(tournamentMatches)
        .set({ ...update, updatedAt: new Date() })
        .where(eq(tournamentMatches.id, patch.nextMatchId))
    }

    await this.refreshFixtureReadyStates(tournamentId)
  }

  private async refreshFixtureReadyStates(tournamentId: string) {
    const fixtures = await db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournamentId))

    for (const f of fixtures) {
      if (f.status === 'completed' || f.status === 'walkover' || f.status === 'live') continue
      const nextStatus =
        f.team1EntryId && f.team2EntryId
          ? f.status === 'scheduled'
            ? 'ready'
            : f.status
          : 'scheduled'
      if (nextStatus !== f.status) {
        await db
          .update(tournamentMatches)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(tournamentMatches.id, f.id))
      }
    }
  }

  private async insertFixtures(
    tournamentId: string,
    bestOf: number,
    generated: GeneratedFixture[],
  ) {
    const idByKey = new Map<string, string>()

    for (const g of generated) {
      const [row] = await db
        .insert(tournamentMatches)
        .values({
          tournamentId,
          roundKey: g.roundKey,
          bracketSide: g.bracketSide,
          position: g.position,
          team1EntryId: g.team1EntryId,
          team2EntryId: g.team2EntryId,
          bestOf,
          status:
            g.team1EntryId && g.team2EntryId
              ? 'ready'
              : g.team1EntryId && !g.team2EntryId
                ? 'walkover'
                : 'scheduled',
          winnerEntryId:
            g.team1EntryId && !g.team2EntryId ? g.team1EntryId : null,
        })
        .returning()
      idByKey.set(fixtureKey(g.roundKey, g.position), row!.id)
    }

    for (const g of generated) {
      const id = idByKey.get(fixtureKey(g.roundKey, g.position))
      if (!id) continue

      const nextMatchId = g.nextWin
        ? idByKey.get(fixtureKey(g.nextWin.roundKey, g.nextWin.position))
        : null
      const loserNextMatchId = g.nextLose
        ? idByKey.get(fixtureKey(g.nextLose.roundKey, g.nextLose.position))
        : null

      await db
        .update(tournamentMatches)
        .set({
          nextMatchId: nextMatchId ?? null,
          nextSlot: g.nextWin?.slot ?? null,
          loserNextMatchId: loserNextMatchId ?? null,
          loserNextSlot: g.nextLose?.slot ?? null,
        })
        .where(eq(tournamentMatches.id, id))

      if (g.team1EntryId && !g.team2EntryId) {
        await this.applyAdvance(tournamentId, id)
      }
    }
  }

  private async rosterForTeam(teamId: string, teamSize: number) {
    const view = await teamService.getView(teamId)
    const players = view.members.filter((m) => m.role !== 'coach').slice(0, teamSize)
    const userRows = await db
      .select({ id: users.id, steamId64: users.steamId64, username: users.username })
      .from(users)
      .where(inArray(users.id, players.map((p) => p.userId)))

    return userRows.map((u) => ({
      userId: u.id,
      steamId64: u.steamId64,
      username: u.username,
    }))
  }

  private async buildDetail(t: Tournament): Promise<TournamentDetail> {
    const entries = await db
      .select({
        entry: tournamentEntries,
        teamName: teams.name,
        teamTag: teams.tag,
        logoUrl: teams.logoUrl,
      })
      .from(tournamentEntries)
      .innerJoin(teams, eq(tournamentEntries.teamId, teams.id))
      .where(eq(tournamentEntries.tournamentId, t.id))
      .orderBy(asc(tournamentEntries.seed), asc(tournamentEntries.registeredAt))

    const fixtures = await db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, t.id))
      .orderBy(asc(tournamentMatches.roundKey), asc(tournamentMatches.position))

    const entryName = new Map(
      entries.map((e) => [e.entry.id, e.teamName]),
    )

    const lobbyCodes = new Map<string, string>()
    const lobbyIds = fixtures.map((f) => f.lobbyId).filter(Boolean) as string[]
    if (lobbyIds.length) {
      const lobbyRows = await db.select().from(lobbies).where(inArray(lobbies.id, lobbyIds))
      for (const l of lobbyRows) lobbyCodes.set(l.id, l.code)
    }

    const entryIds = entries.map((e) => e.entry.id)
    const standings =
      t.format === 'swiss' || t.format === 'round_robin'
        ? computeSwissStandings(
            entryIds,
            fixtures
              .filter((f) => f.status === 'completed')
              .map((f) => ({
                team1EntryId: f.team1EntryId,
                team2EntryId: f.team2EntryId,
                score1: f.score1,
                score2: f.score2,
              })),
          )
        : []

    const teamIds = entries.map((e) => e.entry.teamId)
    const rosterRows =
      teamIds.length === 0
        ? []
        : await db
            .select({
              teamId: teamMembers.teamId,
              userId: teamMembers.userId,
              role: teamMembers.role,
              username: users.username,
              avatarUrl: users.avatarUrl,
              steamId64: users.steamId64,
            })
            .from(teamMembers)
            .innerJoin(users, eq(teamMembers.userId, users.id))
            .where(inArray(teamMembers.teamId, teamIds))

    const membersByTeam = new Map<string, EntryView['members']>()
    for (const row of rosterRows) {
      const list = membersByTeam.get(row.teamId) ?? []
      list.push({
        userId: row.userId,
        steamId64: row.steamId64,
        username: row.username,
        avatarUrl: row.avatarUrl,
        role: row.role,
      })
      membersByTeam.set(row.teamId, list)
    }

    const count = entries.filter((e) => e.entry.status !== 'withdrawn').length

    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description,
      imageUrl: t.imageUrl,
      status: t.status,
      format: t.format,
      teamSize: t.teamSize,
      maxTeams: t.maxTeams,
      startsAt: t.startsAt,
      entryCount: count,
      organizerUserId: t.organizerUserId,
      checkInRequired: t.checkInRequired,
      registrationOpensAt: t.registrationOpensAt,
      registrationClosesAt: t.registrationClosesAt,
      settings: t.settings,
      entries: entries.map((e) => ({
        id: e.entry.id,
        teamId: e.entry.teamId,
        teamName: e.teamName,
        teamTag: e.teamTag,
        logoUrl: e.logoUrl,
        seed: e.entry.seed,
        status: e.entry.status,
        registeredAt: e.entry.registeredAt,
        members: membersByTeam.get(e.entry.teamId) ?? [],
      })),
      fixtures: fixtures.map((f) => ({
        id: f.id,
        roundKey: f.roundKey,
        bracketSide: f.bracketSide,
        position: f.position,
        team1EntryId: f.team1EntryId,
        team2EntryId: f.team2EntryId,
        team1Name: f.team1EntryId ? (entryName.get(f.team1EntryId) ?? null) : null,
        team2Name: f.team2EntryId ? (entryName.get(f.team2EntryId) ?? null) : null,
        score1: f.score1,
        score2: f.score2,
        bestOf: f.bestOf,
        status: f.status,
        scheduledAt: f.scheduledAt,
        lobbyId: f.lobbyId,
        lobbyCode: f.lobbyId ? (lobbyCodes.get(f.lobbyId) ?? null) : null,
        winnerEntryId: f.winnerEntryId,
        nextMatchId: f.nextMatchId,
        nextSlot: f.nextSlot,
      })),
      standings,
    }
  }

  private async requireFixture(tournamentId: string, matchId: string) {
    const fixture = await db.query.tournamentMatches.findFirst({
      where: and(eq(tournamentMatches.id, matchId), eq(tournamentMatches.tournamentId, tournamentId)),
    })
    if (!fixture) throw new NotFoundError('Fixture not found')
    return fixture
  }

  private async requireOrganizer(userId: string, tournamentId: string) {
    const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) })
    if (!t) throw new NotFoundError('Tournament not found')
    if (t.organizerUserId !== userId) {
      throw new ForbiddenError('Only the tournament organizer can perform this action')
    }
    return t
  }

  private async allocateSlug(title: string): Promise<string> {
    const base = slugifyTitle(title)
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? base : `${base}-${i + 1}`
      const existing = await db.query.tournaments.findFirst({ where: eq(tournaments.slug, slug) })
      if (!existing) return slug
    }
    throw new Error('Failed to allocate tournament slug')
  }
}

export const tournamentService = new TournamentService()
