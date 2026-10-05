import { createApp } from './app'
import { env } from './config/env'
import { startJobWorker } from './services/redis/job-queue'
import { rehydrateReadyChecksFromDb } from './services/redis/ready-check-rehydrate'
import { readyCheckScheduler } from './services/redis/ready-check'
import { lobbyService } from './services/lobby.service'
import {
  authenticateWebSocket,
  websocketHandlers,
} from './services/websocket/handler'
import { wsHub } from './services/websocket/hub'
import type { WsSessionData } from './services/websocket/types'

const app = createApp()

await wsHub.init()
readyCheckScheduler.start((lobbyId) => lobbyService.handleReadyCheckExpired(lobbyId))

const restoredReadyChecks = await rehydrateReadyChecksFromDb((lobbyId) =>
  lobbyService.handleReadyCheckExpired(lobbyId),
)
startJobWorker()

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
          subscribedTournamentIds: new Set<string>(),
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

console.log(`Fragstack backend listening on http://localhost:${server.port}`)
console.log(`WebSocket endpoint: ws://localhost:${server.port}/ws`)
console.log(
  `Redis: pub/sub, ready-check (rehydrated ${restoredReadyChecks}), job worker active`,
)
