import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import {
  addTeamMemberSchema,
  createTeamSchema,
  updateTeamSchema,
} from '../lib/tournament-settings'
import { teamService } from '../services/team.service'
import type { AppEnv } from '../types/hono'

export const teamRoutes = new Hono<AppEnv>()

const updateMemberRoleSchema = z.object({
  role: z.enum(['captain', 'player', 'coach']),
})

teamRoutes.get('/', async (c) => {
  const mine = c.req.query('mine') === '1'
  const user = c.get('user')
  const teams = await teamService.list({
    mineForUserId: mine && user ? user.id : undefined,
  })
  return c.json({ teams })
})

teamRoutes.get('/invite/:token', async (c) => {
  const preview = await teamService.getInvitePreview(c.req.param('token'))
  return c.json({ invite: preview })
})

teamRoutes.post('/join/:token', requireAuth, async (c) => {
  const user = c.get('user')!
  const team = await teamService.joinByInvite(user, c.req.param('token'))
  return c.json({ team })
})

teamRoutes.get('/:teamId', async (c) => {
  const user = c.get('user')
  const team = await teamService.getView(c.req.param('teamId'), user?.id)
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

teamRoutes.delete('/:teamId', requireAuth, async (c) => {
  const user = c.get('user')!
  await teamService.delete(user, c.req.param('teamId'))
  return c.json({ ok: true })
})

teamRoutes.post('/:teamId/invite/regenerate', requireAuth, async (c) => {
  const user = c.get('user')!
  const team = await teamService.regenerateInvite(user, c.req.param('teamId'))
  return c.json({ team })
})

teamRoutes.post('/:teamId/leave', requireAuth, async (c) => {
  const user = c.get('user')!
  const result = await teamService.leave(user, c.req.param('teamId'))
  return c.json(result)
})

teamRoutes.post('/:teamId/members', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = addTeamMemberSchema.parse(await c.req.json())
  const team = await teamService.addMember(user, c.req.param('teamId'), body)
  return c.json({ team })
})

teamRoutes.patch('/:teamId/members/:userId', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = updateMemberRoleSchema.parse(await c.req.json())
  const team = await teamService.updateMemberRole(
    user,
    c.req.param('teamId'),
    c.req.param('userId'),
    body.role,
  )
  return c.json({ team })
})

teamRoutes.delete('/:teamId/members/:userId', requireAuth, async (c) => {
  const user = c.get('user')!
  const team = await teamService.removeMember(user, c.req.param('teamId'), c.req.param('userId'))
  return c.json({ team })
})
