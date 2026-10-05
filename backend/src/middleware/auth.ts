import { createMiddleware } from 'hono/factory'
import { authService } from '../services/auth.service'
import type { AppEnv } from '../types/hono'
import { UnauthorizedError } from '../lib/errors'

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const token = authService.getSessionToken(c)
  const user = await authService.resolveUser(token)
  c.set('user', user)
  await next()
})

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  if (!user) {
    throw new UnauthorizedError()
  }
  await next()
})
