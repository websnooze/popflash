import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './config/env'
import { sessionMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'
import { authRoutes } from './routes/auth'
import { lobbyRoutes } from './routes/lobbies'
import { matchRoutes } from './routes/matches'
import { metaRoutes } from './routes/meta'
import { teamRoutes } from './routes/teams'
import { templateRoutes } from './routes/templates'
import { tournamentRoutes } from './routes/tournaments'
import { webhookRoutes } from './routes/webhooks'
import type { AppEnv } from './types/hono'

export function createApp() {
  const app = new Hono<AppEnv>()

  app.onError(errorHandler)
  app.use('*', logger())
  app.use(
    '*',
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  app.use('*', sessionMiddleware)

  app.route('/', metaRoutes)
  app.route('/auth', authRoutes)
  app.route('/lobbies', lobbyRoutes)
  app.route('/templates', templateRoutes)
  app.route('/teams', teamRoutes)
  app.route('/tournaments', tournamentRoutes)
  app.route('/matches', matchRoutes)
  app.route('/webhooks', webhookRoutes)

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      },
      404,
    ),
  )

  return app
}
