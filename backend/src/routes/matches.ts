import { Hono } from 'hono'
import { env } from '../config/env'
import { ForbiddenError } from '../lib/errors'
import { requireAuth } from '../middleware/auth'
import { matchService } from '../services/match.service'
import { fragstackBridgeService } from '../services/fragstack-bridge.service'
import type { AppEnv } from '../types/hono'

export const matchRoutes = new Hono<AppEnv>()

matchRoutes.post('/launch/:lobbyId', requireAuth, async (c) => {
  const user = c.get('user')!
  const match = await matchService.launchFromLobby(user, c.req.param('lobbyId'))
  return c.json({ match }, 201)
})

matchRoutes.get('/lobby/:lobbyId/latest', async (c) => {
  const match = await matchService.getLatestMatchForLobby(c.req.param('lobbyId'))
  return c.json({ match })
})

/** Fragstack / Get5 JSON consumed by `fragstack_loadmatch_url`. */
matchRoutes.get('/:matchId/fragstack.json', async (c) => {
  const authorization = c.req.header('authorization')
  if (authorization !== env.DATHOST_WEBHOOK_SECRET) {
    throw new ForbiddenError('Invalid Fragstack config authorization')
  }

  const config = await fragstackBridgeService.getMatchConfig(c.req.param('matchId'))
  return c.json(config)
})

matchRoutes.get('/:matchId', async (c) => {
  const match = await matchService.getMatchView(c.req.param('matchId'))
  return c.json({ match })
})

matchRoutes.post('/:matchId/cancel', requireAuth, async (c) => {
  const user = c.get('user')!
  const match = await matchService.cancelMatch(user, c.req.param('matchId'))
  return c.json({ match })
})
