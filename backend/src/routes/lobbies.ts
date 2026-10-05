import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { createLobbySchema, lobbyService } from '../services/lobby.service'
import type { AppEnv } from '../types/hono'

export const lobbyRoutes = new Hono<AppEnv>()

lobbyRoutes.get('/', async (c) => {
  const lobbies = await lobbyService.listPublicLobbies()
  return c.json({ lobbies })
})

lobbyRoutes.get('/code/:code', async (c) => {
  const lobby = await lobbyService.getLobbyByCode(c.req.param('code'))
  return c.json({ lobby })
})

lobbyRoutes.post('/', requireAuth, async (c) => {
  const body = createLobbySchema.parse(await c.req.json().catch(() => ({})))
  const user = c.get('user')!
  const lobby = await lobbyService.createLobby(user, body)
  return c.json({ lobby }, 201)
})

lobbyRoutes.get('/:lobbyId', async (c) => {
  const lobby = await lobbyService.getLobbyView(c.req.param('lobbyId'))
  return c.json({ lobby })
})

lobbyRoutes.post('/join', requireAuth, async (c) => {
  const body = z
    .object({
      code: z.string().min(4).max(8),
      asSpectator: z.boolean().default(false),
      password: z.string().min(4).max(64).optional(),
    })
    .parse(await c.req.json())
  const user = c.get('user')!
  const lobby = await lobbyService.joinLobby(user, body.code, {
    asSpectator: body.asSpectator,
    password: body.password,
  })
  return c.json({ lobby })
})

lobbyRoutes.get('/:lobbyId/chat', async (c) => {
  const limit = Number(c.req.query('limit') ?? 100)
  const user = c.get('user')
  const messages = await lobbyService.getChatHistory(c.req.param('lobbyId'), {
    userId: user?.id,
    limit,
  })
  return c.json({ messages })
})
