import { Hono } from 'hono'
import type { DathostMatch } from '../services/dathost/types'
import { matchService } from '../services/match.service'
import type { AppEnv } from '../types/hono'

export const webhookRoutes = new Hono<AppEnv>()

webhookRoutes.post('/dathost', async (c) => {
  const authorization = c.req.header('authorization')
  const payload = (await c.req.json()) as DathostMatch

  await matchService.handleWebhook(authorization, payload)

  return c.json({ ok: true })
})
