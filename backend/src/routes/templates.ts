import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { saveTemplateSchema } from '../lib/lobby-settings'
import { templateService } from '../services/template.service'
import type { AppEnv } from '../types/hono'

export const templateRoutes = new Hono<AppEnv>()

templateRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user')!
  const templates = await templateService.list(user.id)
  return c.json({ templates })
})

templateRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user')!
  const body = saveTemplateSchema.parse(await c.req.json())
  const template = await templateService.save(user, body)
  return c.json({ template }, 201)
})

templateRoutes.delete('/:templateId', requireAuth, async (c) => {
  const user = c.get('user')!
  await templateService.remove(user, c.req.param('templateId'))
  return c.json({ ok: true })
})
