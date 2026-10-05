import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import {
  createTournamentSchema,
  patchFixtureSchema,
  registerEntrySchema,
  updateTournamentSchema,
} from '../lib/tournament-settings'
import { tournamentService } from '../services/tournament.service'
import type { AppEnv } from '../types/hono'

export const tournamentRoutes = new Hono<AppEnv>()

tournamentRoutes.get('/', async (c) => {
  const tournaments = await tournamentService.list()
  return c.json({ tournaments })
})

tournamentRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = createTournamentSchema.parse(await c.req.json())
  const tournament = await tournamentService.create(user, body)
  return c.json({ tournament }, 201)
})

tournamentRoutes.get('/slug/:slug', async (c) => {
  const tournament = await tournamentService.getBySlug(c.req.param('slug'))
  return c.json({ tournament })
})

tournamentRoutes.get('/:id', async (c) => {
  const tournament = await tournamentService.getById(c.req.param('id'))
  return c.json({ tournament })
})

tournamentRoutes.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = updateTournamentSchema.parse(await c.req.json())
  const tournament = await tournamentService.update(user, c.req.param('id'), body)
  return c.json({ tournament })
})

tournamentRoutes.post('/:id/publish', requireAuth, async (c) => {
  const user = c.get('user')!
  const tournament = await tournamentService.setStatus(user, c.req.param('id'), 'registration')
  return c.json({ tournament })
})

tournamentRoutes.post('/:id/open-registration', requireAuth, async (c) => {
  const user = c.get('user')!
  const tournament = await tournamentService.setStatus(user, c.req.param('id'), 'registration')
  return c.json({ tournament })
})

tournamentRoutes.post('/:id/close-registration', requireAuth, async (c) => {
  const user = c.get('user')!
  const tournament = await tournamentService.setStatus(user, c.req.param('id'), 'seeding')
  return c.json({ tournament })
})

tournamentRoutes.post('/:id/generate-bracket', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = (await c.req.json().catch(() => ({}))) as { randomSeed?: boolean }
  const tournament = await tournamentService.generateBracket(
    user,
    c.req.param('id'),
    body.randomSeed ?? false,
  )
  return c.json({ tournament })
})

tournamentRoutes.post('/:id/entries', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = registerEntrySchema.parse(await c.req.json())
  const tournament = await tournamentService.registerEntry(user, c.req.param('id'), body.teamId)
  return c.json({ tournament })
})

tournamentRoutes.post('/:id/check-in', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = (await c.req.json()) as { entryId: string }
  const tournament = await tournamentService.checkIn(user, c.req.param('id'), body.entryId)
  return c.json({ tournament })
})

tournamentRoutes.get('/:id/bracket', async (c) => {
  const tournament = await tournamentService.getById(c.req.param('id'))
  return c.json({
    fixtures: tournament.fixtures,
    standings: tournament.standings,
    format: tournament.format,
  })
})

tournamentRoutes.patch('/:id/matches/:matchId', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = patchFixtureSchema.parse(await c.req.json())
  const tournament = await tournamentService.patchFixture(
    user,
    c.req.param('id'),
    c.req.param('matchId'),
    body,
  )
  return c.json({ tournament })
})

tournamentRoutes.post('/:id/matches/:matchId/open-lobby', requireAuth, async (c) => {
  const user = c.get('user')!
  const result = await tournamentService.openLobby(user, c.req.param('id'), c.req.param('matchId'))
  return c.json(result)
})
