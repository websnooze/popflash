import { env } from '../../config/env'
import {
  dathostCircuitAllow,
  dathostCircuitRecordFailure,
  dathostCircuitRecordSuccess,
} from '../../lib/redis'
import type {
  DathostCreateMatchInput,
  DathostDuplicateOptions,
  DathostGameServer,
  DathostMatch,
  DathostMatchPlayerInput,
} from './types'

const DATHOST_BASE_URL = 'https://dathost.com/api/0.1'

export class DathostApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string,
  ) {
    super(message)
    this.name = 'DathostApiError'
  }
}

export class DathostClient {
  private readonly authHeader: string

  constructor(
    email = env.DATHOST_EMAIL,
    password = env.DATHOST_PASSWORD,
  ) {
    this.authHeader = `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`
  }

  async duplicateServer(
    templateServerId: string,
    options: DathostDuplicateOptions = {},
  ): Promise<DathostGameServer> {
    const form = new FormData()
    if (options.location) {
      form.set('location', options.location)
    }

    return this.request<DathostGameServer>(
      'POST',
      `/game-servers/${templateServerId}/duplicate`,
      form,
    )
  }

  async updateServer(
    serverId: string,
    fields: Record<string, string>,
  ): Promise<DathostGameServer> {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value)
    }

    return this.request<DathostGameServer>('PUT', `/game-servers/${serverId}`, form)
  }

  async getServer(serverId: string): Promise<DathostGameServer> {
    return this.request<DathostGameServer>('GET', `/game-servers/${serverId}`)
  }

  async deleteServer(serverId: string): Promise<void> {
    await this.request<void>('DELETE', `/game-servers/${serverId}`)
  }

  async createMatch(input: DathostCreateMatchInput): Promise<DathostMatch> {
    return this.request<DathostMatch>('POST', '/cs2-matches', JSON.stringify(input), {
      'Content-Type': 'application/json',
    })
  }

  async getMatch(matchId: string): Promise<DathostMatch> {
    return this.request<DathostMatch>('GET', `/cs2-matches/${matchId}`)
  }

  async cancelMatch(matchId: string): Promise<DathostMatch> {
    return this.request<DathostMatch>('POST', `/cs2-matches/${matchId}/cancel`)
  }

  async addPlayer(matchId: string, player: DathostMatchPlayerInput): Promise<unknown> {
    return this.request('POST', `/cs2-matches/${matchId}/players`, JSON.stringify(player), {
      'Content-Type': 'application/json',
    })
  }

  /** Send a console / RCON-equivalent line via DatHost (no in-game RCON password needed). */
  async sendConsole(serverId: string, line: string): Promise<void> {
    const form = new FormData()
    form.set('line', line)
    await this.request<void>('POST', `/game-servers/${serverId}/console`, form)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: BodyInit | null,
    headers: Record<string, string> = {},
  ): Promise<T> {
    if (!(await dathostCircuitAllow())) {
      throw new DathostApiError(503, 'DatHost circuit breaker open — try again shortly')
    }

    const response = await fetch(`${DATHOST_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        ...headers,
      },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      await dathostCircuitRecordFailure()
      throw new DathostApiError(
        response.status,
        `DatHost API ${method} ${path} failed with ${response.status}`,
        text,
      )
    }

    await dathostCircuitRecordSuccess()

    if (response.status === 204) {
      return undefined as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return undefined as T
    }

    return (await response.json()) as T
  }
}

export const dathostClient = new DathostClient()
