import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { teamMembers, teams, tournamentEntries, users } from '../db/schema'
import { env } from '../config/env'
import { generateInviteToken } from '../lib/crypto'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors'
import {
  cacheGet,
  cacheSet,
  invalidateTeamCache,
  rateLimit,
  RedisKeys,
} from '../lib/redis'
import type { AuthUser } from '../types/hono'

export type TeamMemberView = {
  userId: string
  steamId64: string
  username: string
  avatarUrl: string | null
  profileUrl: string | null
  role: 'captain' | 'player' | 'coach'
}

export type TeamView = {
  id: string
  name: string
  tag: string | null
  logoUrl: string | null
  captainUserId: string
  members: TeamMemberView[]
  inviteToken: string | null
  inviteUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export class TeamService {
  async list(options: { mineForUserId?: string } = {}): Promise<TeamView[]> {
    let rows = await db.select().from(teams).orderBy(desc(teams.createdAt))

    if (options.mineForUserId) {
      const memberships = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(eq(teamMembers.userId, options.mineForUserId))
      const ids = new Set(memberships.map((m) => m.teamId))
      rows = rows.filter((t) => ids.has(t.id))
    }

    return Promise.all(rows.map((t) => this.getView(t.id, options.mineForUserId)))
  }

  async create(user: AuthUser, input: { name: string; tag?: string; logoUrl?: string }): Promise<TeamView> {
    const inviteToken = generateInviteToken()
    const [team] = await db
      .insert(teams)
      .values({
        name: input.name,
        tag: input.tag ?? null,
        logoUrl: input.logoUrl ?? null,
        inviteToken,
        captainUserId: user.id,
      })
      .returning()

    await db.insert(teamMembers).values({
      teamId: team!.id,
      userId: user.id,
      role: 'captain',
    })

    await invalidateTeamCache(team!.id)
    return this.getView(team!.id, user.id)
  }

  async getView(teamId: string, viewerUserId?: string): Promise<TeamView> {
    const viewerKey = viewerUserId ?? 'anon'
    const cached = await cacheGet<TeamView>(RedisKeys.cacheTeamView(teamId, viewerKey))
    if (cached) return cached

    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) })
    if (!team) throw new NotFoundError('Team not found')

    const members = await this.loadMembers(teamId)
    const canSeeInvite = viewerUserId === team.captainUserId

    const view: TeamView = {
      id: team.id,
      name: team.name,
      tag: team.tag,
      logoUrl: team.logoUrl,
      captainUserId: team.captainUserId,
      members,
      inviteToken: canSeeInvite ? team.inviteToken : null,
      inviteUrl: canSeeInvite ? this.buildInviteUrl(team.inviteToken) : null,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    }

    await cacheSet(RedisKeys.cacheTeamView(teamId, viewerKey), view, 30)
    return view
  }

  async getInvitePreview(token: string): Promise<{
    teamId: string
    name: string
    tag: string | null
    logoUrl: string | null
    memberCount: number
    members: TeamMemberView[]
  }> {
    const team = await db.query.teams.findFirst({ where: eq(teams.inviteToken, token) })
    if (!team) throw new NotFoundError('Invite link not found')
    const members = await this.loadMembers(team.id)
    return {
      teamId: team.id,
      name: team.name,
      tag: team.tag,
      logoUrl: team.logoUrl,
      memberCount: members.length,
      members,
    }
  }

  async joinByInvite(user: AuthUser, token: string): Promise<TeamView> {
    const team = await db.query.teams.findFirst({ where: eq(teams.inviteToken, token) })
    if (!team) throw new NotFoundError('Invite link not found')

    const existing = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id)),
    })
    if (existing) return this.getView(team.id, user.id)

    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: 'player',
    })

    await invalidateTeamCache(team.id)
    return this.getView(team.id, user.id)
  }

  async regenerateInvite(user: AuthUser, teamId: string): Promise<TeamView> {
    await this.requireCaptain(user.id, teamId)

    const rl = await rateLimit(RedisKeys.rateLimitInviteRegenerate(teamId), 3, 3600)
    if (!rl.allowed) {
      throw new BadRequestError('Invite link was regenerated too recently')
    }

    const inviteToken = generateInviteToken()
    await db
      .update(teams)
      .set({ inviteToken, updatedAt: new Date() })
      .where(eq(teams.id, teamId))

    await invalidateTeamCache(teamId)
    return this.getView(teamId, user.id)
  }

  async update(
    user: AuthUser,
    teamId: string,
    patch: { name?: string; tag?: string; logoUrl?: string },
  ): Promise<TeamView> {
    const team = await this.requireCaptain(user.id, teamId)
    await db
      .update(teams)
      .set({
        name: patch.name ?? team.name,
        tag: patch.tag !== undefined ? patch.tag : team.tag,
        logoUrl: patch.logoUrl !== undefined ? patch.logoUrl : team.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
    await invalidateTeamCache(teamId)
    return this.getView(teamId, user.id)
  }

  async addMember(
    user: AuthUser,
    teamId: string,
    input: { userId: string; role: 'captain' | 'player' | 'coach' },
  ): Promise<TeamView> {
    await this.requireCaptain(user.id, teamId)

    const target = await db.query.users.findFirst({ where: eq(users.id, input.userId) })
    if (!target) throw new NotFoundError('User not found')

    await db
      .insert(teamMembers)
      .values({ teamId, userId: input.userId, role: input.role })
      .onConflictDoNothing()

    if (input.role === 'captain') {
      await this.transferCaptainInternal(teamId, user.id, input.userId)
    }

    await invalidateTeamCache(teamId)
    return this.getView(teamId, user.id)
  }

  async updateMemberRole(
    user: AuthUser,
    teamId: string,
    targetUserId: string,
    role: 'captain' | 'player' | 'coach',
  ): Promise<TeamView> {
    await this.requireCaptain(user.id, teamId)
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)),
    })
    if (!membership) throw new NotFoundError('Member not found')

    if (role === 'captain') {
      await this.transferCaptainInternal(teamId, user.id, targetUserId)
    } else {
      if (targetUserId === user.id) {
        throw new BadRequestError('Transfer captain role before demoting yourself')
      }
      await db
        .update(teamMembers)
        .set({ role })
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
    }

    await invalidateTeamCache(teamId)
    return this.getView(teamId, user.id)
  }

  async removeMember(user: AuthUser, teamId: string, userId: string): Promise<TeamView> {
    const team = await this.requireCaptain(user.id, teamId)
    if (userId === team.captainUserId) {
      throw new BadRequestError('Transfer captain role before removing the captain')
    }
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    await invalidateTeamCache(teamId)
    return this.getView(teamId, user.id)
  }

  async leave(user: AuthUser, teamId: string): Promise<{ ok: true } | TeamView> {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) })
    if (!team) throw new NotFoundError('Team not found')

    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)),
    })
    if (!membership) throw new BadRequestError('You are not a member of this team')

    if (team.captainUserId === user.id) {
      throw new BadRequestError('Transfer captaincy or delete the team before leaving')
    }

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)))

    await invalidateTeamCache(teamId)
    return { ok: true }
  }

  async delete(user: AuthUser, teamId: string): Promise<void> {
    await this.requireCaptain(user.id, teamId)

    const activeEntries = await db
      .select({ id: tournamentEntries.id })
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.teamId, teamId),
          inArray(tournamentEntries.status, ['pending', 'accepted', 'checked_in']),
        ),
      )
      .limit(1)

    if (activeEntries.length > 0) {
      throw new ConflictError('Withdraw from active tournaments before deleting the team')
    }

    await db.delete(teams).where(eq(teams.id, teamId))
  }

  async requireCaptain(userId: string, teamId: string) {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) })
    if (!team) throw new NotFoundError('Team not found')
    if (team.captainUserId !== userId) {
      throw new ForbiddenError('Only the team captain can perform this action')
    }
    return team
  }

  async isCaptain(userId: string, teamId: string): Promise<boolean> {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) })
    return team?.captainUserId === userId
  }

  async isMember(userId: string, teamId: string): Promise<boolean> {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    })
    return !!membership
  }

  private async transferCaptainInternal(teamId: string, fromUserId: string, toUserId: string) {
    await db
      .update(teamMembers)
      .set({ role: 'player' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, fromUserId)))
    await db
      .update(teamMembers)
      .set({ role: 'captain' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, toUserId)))
    await db
      .update(teams)
      .set({ captainUserId: toUserId, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
  }

  private async loadMembers(teamId: string): Promise<TeamMemberView[]> {
    const members = await db
      .select({
        userId: teamMembers.userId,
        role: teamMembers.role,
        username: users.username,
        avatarUrl: users.avatarUrl,
        steamId64: users.steamId64,
        profileUrl: users.profileUrl,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId))

    return members.map((m) => ({
      userId: m.userId,
      steamId64: m.steamId64,
      username: m.username,
      avatarUrl: m.avatarUrl,
      profileUrl: m.profileUrl,
      role: m.role,
    }))
  }

  private buildInviteUrl(token: string): string {
    return `${env.FRONTEND_URL.replace(/\/$/, '')}/teams/join/${token}`
  }
}

export const teamService = new TeamService()
