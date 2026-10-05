import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { matchService } from '../services/match.service'
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

matchRoutes.get('/:matchId', async (c) => {
  const match = await matchService.getMatchView(c.req.param('matchId'))
  return c.json({ match })
})

matchRoutes.post('/:matchId/cancel', requireAuth, async (c) => {
  const user = c.get('user')!
  const match = await matchService.cancelMatch(user, c.req.param('matchId'))
  return c.json({ match })
})
