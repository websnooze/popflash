export type DathostTeam = 'team1' | 'team2' | 'spectator'

export type DathostMatchPlayerInput = {
  steam_id_64: string
  team: DathostTeam
  nickname_override?: string
}

export type DathostMatchSettings = {
  map?: string | null
  password?: string | null
  connect_time?: number
  match_begin_countdown?: number
  team_size?: number | null
  wait_for_gotv?: boolean
  enable_plugin?: boolean
  enable_tech_pause?: boolean
}

export type DathostMatchWebhooks = {
  event_url?: string
  enabled_events?: string[]
  authorization_header?: string
  match_end_url?: string
  round_end_url?: string
  player_votekick_success_url?: string
}

export type DathostCreateMatchInput = {
  game_server_id: string
  players: DathostMatchPlayerInput[]
  team1?: { name?: string; flag?: string }
  team2?: { name?: string; flag?: string }
  settings?: DathostMatchSettings
  webhooks?: DathostMatchWebhooks
}

export type DathostPlayerStats = {
  kills: number
  assists: number
  deaths: number
  mvps: number
  score: number
  '2ks': number
  '3ks': number
  '4ks': number
  '5ks': number
  kills_with_headshot: number
  kills_with_pistol: number
  kills_with_sniper: number
  damage_dealt: number
  entry_attempts: number
  entry_successes: number
  flashes_thrown: number
  flashes_successful: number
  flashes_enemies_blinded: number
  utility_thrown: number
  utility_damage: number
  '1vX_attempts': number
  '1vX_wins': number
}

export type DathostMatchPlayer = {
  match_id: string
  steam_id_64: string
  team: DathostTeam
  nickname_override?: string | null
  connected: boolean
  kicked: boolean
  disconnected_at?: number | null
  stats?: DathostPlayerStats
}

export type DathostMatchEvent = {
  event: string
  timestamp: number
  payload?: Record<string, unknown>
}

export type DathostMatch = {
  id: string
  game_server_id: string
  team1: {
    name: string
    flag?: string
    stats?: { score: number }
  }
  team2: {
    name: string
    flag?: string
    stats?: { score: number }
  }
  players: DathostMatchPlayer[]
  settings: DathostMatchSettings
  webhooks?: DathostMatchWebhooks
  rounds_played: number
  finished: boolean
  cancel_reason: string | null
  events?: DathostMatchEvent[]
}

export type DathostGameServer = {
  id: string
  name: string
  on: boolean
  booting: boolean
  location: string
  ip?: string | null
  raw_ip?: string | null
  ports?: {
    game: number
    gotv?: number
  }
  cs2_settings?: {
    slots?: number
    password?: string | null
    rcon?: string | null
  }
  user_data?: string | null
}

export type DathostDuplicateOptions = {
  location?: string
}
