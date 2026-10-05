import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import {
  addTeamMemberSchema,
  createTeamSchema,
  updateTeamSchema,
} from '../lib/tournament-settings'
import { teamService } from '../services/team.service'
import type { AppEnv } from '../types/hono'

export const teamRoutes = new Hono<AppEnv>()

teamRoutes.get('/', async (c) => {
  const teams = await teamService.list()
  return c.json({ teams })
})

teamRoutes.get('/:teamId', async (c) => {
  const team = await teamService.getView(c.req.param('teamId'))
  return c.json({ team })
})

teamRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = createTeamSchema.parse(await c.req.json())
  const team = await teamService.create(user, body)
  return c.json({ team }, 201)
})

teamRoutes.patch('/:teamId', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = updateTeamSchema.parse(await c.req.json())
  const team = await teamService.update(user, c.req.param('teamId'), body)
  return c.json({ team })
})

teamRoutes.post('/:teamId/members', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = addTeamMemberSchema.parse(await c.req.json())
  const team = await teamService.addMember(user, c.req.param('teamId'), body)
  return c.json({ team })
})

teamRoutes.delete('/:teamId/members/:userId', requireAuth, async (c) => {
  const user = c.get('user')!
  const team = await teamService.removeMember(user, c.req.param('teamId'), c.req.param('userId'))
  return c.json({ team })
})
