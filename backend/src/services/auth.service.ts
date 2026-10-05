import { and, eq, gt } from 'drizzle-orm'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { env } from '../config/env'
import { db } from '../db'
import { sessions, users } from '../db/schema'
import { SESSION_TTL_MS } from '../lib/constants'
import { generateSessionToken, hashToken } from '../lib/crypto'
import { UnauthorizedError } from '../lib/errors'
import { redis, RedisKeys } from '../lib/redis'
import { fetchSteamProfile, verifySteamOpenId } from '../lib/steam'
import type { AuthUser } from '../types/hono'

function toAuthUser(row: {
  userId: string
  steamId64: string
  username: string
  avatarUrl: string | null
  profileUrl: string | null
}): AuthUser {
  return {
    id: row.userId,
    steamId64: row.steamId64,
    username: row.username,
    avatarUrl: row.avatarUrl,
    profileUrl: row.profileUrl,
  }
}

export class AuthService {
  async loginWithSteam(query: Record<string, string>): Promise<{ user: AuthUser; token: string }> {
    const steamId64 = await verifySteamOpenId(query)
    const profile = await fetchSteamProfile(steamId64)

    const existing = await db.query.users.findFirst({
      where: eq(users.steamId64, steamId64),
    })

    let user: AuthUser

    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          profileUrl: profile.profileUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning({
          id: users.id,
          steamId64: users.steamId64,
          username: users.username,
          avatarUrl: users.avatarUrl,
          profileUrl: users.profileUrl,
        })

      user = {
        id: updated!.id,
        steamId64: updated!.steamId64,
        username: updated!.username,
        avatarUrl: updated!.avatarUrl,
        profileUrl: updated!.profileUrl,
      }
    } else {
      const [created] = await db
        .insert(users)
        .values({
          steamId64: profile.steamId64,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          profileUrl: profile.profileUrl,
        })
        .returning({
          id: users.id,
          steamId64: users.steamId64,
          username: users.username,
          avatarUrl: users.avatarUrl,
          profileUrl: users.profileUrl,
        })

      user = {
        id: created!.id,
        steamId64: created!.steamId64,
        username: created!.username,
        avatarUrl: created!.avatarUrl,
        profileUrl: created!.profileUrl,
      }
    }

    const token = await this.createSession(user.id)
    return { user, token }
  }

  async createSession(userId: string): Promise<string> {
    const token = generateSessionToken()
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    const tokenHash = hashToken(token)

    await db.insert(sessions).values({
      userId,
      tokenHash,
      expiresAt,
    })

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (user) {
      const authUser: AuthUser = {
        id: user.id,
        steamId64: user.steamId64,
        username: user.username,
        avatarUrl: user.avatarUrl,
        profileUrl: user.profileUrl,
      }
      const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      await redis.set(RedisKeys.session(tokenHash), JSON.stringify(authUser), 'EX', ttlSeconds)
    }

    return token
  }

  async resolveUser(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null

    const tokenHash = hashToken(token)
    const cached = await redis.get(RedisKeys.session(tokenHash))
    if (cached) {
      try {
        return JSON.parse(cached) as AuthUser
      } catch {
        await redis.del(RedisKeys.session(tokenHash))
      }
    }

    const row = await db
      .select({
        userId: users.id,
        steamId64: users.steamId64,
        username: users.username,
        avatarUrl: users.avatarUrl,
        profileUrl: users.profileUrl,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
      .limit(1)

    if (!row[0]) return null

    const user = toAuthUser(row[0])
    const ttlSeconds = Math.max(1, Math.floor((row[0].expiresAt.getTime() - Date.now()) / 1000))
    await redis.set(
      RedisKeys.session(tokenHash),
      JSON.stringify(user),
      'EX',
      Math.min(ttlSeconds, 3600),
    )
    return user
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return
    const tokenHash = hashToken(token)
    await redis.del(RedisKeys.session(tokenHash))
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  }

  setSessionCookie(c: Context, token: string): void {
    setCookie(c, env.COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
  }

  clearSessionCookie(c: Context): void {
    deleteCookie(c, env.COOKIE_NAME, { path: '/' })
  }

  getSessionToken(c: Context): string | undefined {
    return getCookie(c, env.COOKIE_NAME) ?? undefined
  }

  requireUser(user: AuthUser | null): AuthUser {
    if (!user) throw new UnauthorizedError()
    return user
  }
}

export const authService = new AuthService()
