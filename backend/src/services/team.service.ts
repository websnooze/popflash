import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { teamMembers, teams, users } from '../db/schema'
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors'
import type { AuthUser } from '../types/hono'

export type TeamMemberView = {
  userId: string
  username: string
  avatarUrl: string | null
  role: 'captain' | 'player' | 'coach'
}

export type TeamView = {
  id: string
  name: string
  tag: string | null
  logoUrl: string | null
  captainUserId: string
  members: TeamMemberView[]
  createdAt: Date
  updatedAt: Date
}

export class TeamService {
  async list(): Promise<TeamView[]> {
    const rows = await db.select().from(teams).orderBy(teams.createdAt)
    return Promise.all(rows.map((t) => this.getView(t.id)))
  }

  async create(user: AuthUser, input: { name: string; tag?: string; logoUrl?: string }): Promise<TeamView> {
    const [team] = await db
      .insert(teams)
      .values({
        name: input.name,
        tag: input.tag ?? null,
        logoUrl: input.logoUrl ?? null,
        captainUserId: user.id,
      })
      .returning()

    await db.insert(teamMembers).values({
      teamId: team!.id,
      userId: user.id,
      role: 'captain',
    })

    return this.getView(team!.id)
  }

  async getView(teamId: string): Promise<TeamView> {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) })
    if (!team) throw new NotFoundError('Team not found')

    const members = await db
      .select({
        userId: teamMembers.userId,
        role: teamMembers.role,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId))

    return {
      id: team.id,
      name: team.name,
      tag: team.tag,
      logoUrl: team.logoUrl,
      captainUserId: team.captainUserId,
      members: members.map((m) => ({
        userId: m.userId,
        username: m.username,
        avatarUrl: m.avatarUrl,
        role: m.role,
      })),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    }
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
    return this.getView(teamId)
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
      await db.update(teams).set({ captainUserId: input.userId, updatedAt: new Date() }).where(eq(teams.id, teamId))
    }

    return this.getView(teamId)
  }

  async removeMember(user: AuthUser, teamId: string, userId: string): Promise<TeamView> {
    const team = await this.requireCaptain(user.id, teamId)
    if (userId === team.captainUserId) {
      throw new BadRequestError('Transfer captain role before removing the captain')
    }
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    return this.getView(teamId)
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
}

export const teamService = new TeamService()
