import { createApp } from './app'
import { env } from './config/env'
import {
  authenticateWebSocket,
  websocketHandlers,
} from './services/websocket/handler'
import type { WsSessionData } from './services/websocket/types'

const app = createApp()

const server = Bun.serve<WsSessionData>({
  port: env.PORT,
  async fetch(req, server) {
    const url = new URL(req.url)

    if (url.pathname === '/ws') {
      const { userId } = await authenticateWebSocket(req)
      const upgraded = server.upgrade(req, {
        data: {
          userId,
          subscribedLobbyIds: new Set<string>(),
        },
      })

      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      return undefined
    }

    return app.fetch(req, server)
  },
  websocket: websocketHandlers,
})

console.log(`PopFlash backend listening on http://localhost:${server.port}`)
console.log(`WebSocket endpoint: ws://localhost:${server.port}/ws`)
