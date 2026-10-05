import { Hono } from 'hono'
import { env } from '../config/env'
import { buildSteamLoginUrl } from '../lib/steam'
import { authService } from '../services/auth.service'
import { requireAuth } from '../middleware/auth'
import type { AppEnv } from '../types/hono'

export const authRoutes = new Hono<AppEnv>()

authRoutes.get('/steam', (c) => {
  const returnTo = `${env.PUBLIC_URL}/auth/steam/callback`
  return c.redirect(buildSteamLoginUrl(returnTo))
})

authRoutes.get('/steam/callback', async (c) => {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(c.req.query())) {
    if (typeof value === 'string') {
      query[key] = value
    }
  }

  const { token } = await authService.loginWithSteam(query)
  authService.setSessionCookie(c, token)

  return c.redirect(`${env.FRONTEND_URL}/auth/success`)
})

authRoutes.post('/logout', requireAuth, async (c) => {
  const token = authService.getSessionToken(c)
  await authService.logout(token)
  authService.clearSessionCookie(c)
  return c.json({ ok: true })
})

authRoutes.get('/me', requireAuth, (c) => {
  return c.json({ user: c.get('user') })
})
