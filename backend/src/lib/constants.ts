export const ACTIVE_DUTY_MAPS = [
  'de_mirage',
  'de_inferno',
  'de_dust2',
  'de_nuke',
  'de_ancient',
  'de_anubis',
  'de_train',
] as const

export type ActiveDutyMap = (typeof ACTIVE_DUTY_MAPS)[number]

export const GAME_MODES = [
  { id: '1v1', teamSize: 1, label: '1v1' },
  { id: '2v2', teamSize: 2, label: '2v2' },
  { id: '3v3', teamSize: 3, label: '3v3' },
  { id: '5v5', teamSize: 5, label: '5v5' },
] as const

export const BEST_OF_OPTIONS = [1, 3, 5] as const

export const MAP_SELECTION_MODES = [
  { id: 'host', label: 'Selecting host' },
  { id: 'captains_veto', label: 'Captains pick and ban' },
  { id: 'players_vote', label: 'Players vote' },
] as const

export const LOCATION_SELECTION_MODES = [
  { id: 'host', label: 'Selecting host' },
  { id: 'captains_ban', label: 'Captains ban' },
  { id: 'players_vote', label: 'Players vote' },
] as const

export const VOICE_CHAT_OPTIONS = [
  { id: 'allies_only', label: 'Allies only' },
  { id: 'all_players', label: 'All players' },
] as const

export const ARMOR_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'kevlar', label: 'Kevlar' },
  { id: 'kevlar_helmet', label: 'Kevlar + Helmet' },
] as const

export const MAX_ROUNDS_OPTIONS = [16, 24, 30, 60] as const

export const START_MODES = [
  { id: 'by_host', label: 'By host' },
  { id: 'when_ready', label: 'When ready' },
] as const

export const PRIVACY_MODES = [
  { id: 'public', label: 'Public' },
  { id: 'password', label: 'Password protected' },
  { id: 'private', label: 'Private' },
] as const

/** Full DatHost CS2 location catalog (API id → display label) */
export const DATHOST_LOCATIONS = [
  { id: 'stockholm', label: 'Stockholm' },
  { id: 'amsterdam', label: 'Amsterdam' },
  { id: 'dusseldorf', label: 'Frankfurt' },
  { id: 'bristol', label: 'London' },
  { id: 'strasbourg', label: 'Paris' },
  { id: 'helsinki', label: 'Helsinki' },
  { id: 'warsaw', label: 'Warsaw' },
  { id: 'barcelona', label: 'Madrid' },
  { id: 'prague', label: 'Prague' },
  { id: 'copenhagen', label: 'Copenhagen' },
  { id: 'dublin', label: 'Dublin' },
  { id: 'milan', label: 'Milan' },
  { id: 'oslo', label: 'Oslo' },
  { id: 'bucharest', label: 'Bucharest' },
  { id: 'beauharnois', label: 'Toronto' },
  { id: 'new_york_city', label: 'New York' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'los_angeles', label: 'Los Angeles' },
  { id: 'dallas', label: 'Dallas' },
  { id: 'miami', label: 'Miami' },
  { id: 'portland', label: 'Seattle' },
  { id: 'atlanta', label: 'Atlanta' },
  { id: 'denver', label: 'Denver' },
  { id: 'sao_paulo', label: 'São Paulo' },
  { id: 'buenos_aires', label: 'Buenos Aires' },
  { id: 'santiago', label: 'Santiago' },
  { id: 'singapore', label: 'Singapore' },
  { id: 'tokyo', label: 'Tokyo' },
  { id: 'hong_kong', label: 'Hong Kong' },
  { id: 'mumbai', label: 'Mumbai' },
  { id: 'seoul', label: 'Seoul' },
  { id: 'sydney', label: 'Sydney' },
  { id: 'perth', label: 'Perth' },
  { id: 'auckland', label: 'Auckland' },
  { id: 'istanbul', label: 'Istanbul' },
  { id: 'dubai', label: 'Dubai' },
  { id: 'johannesburg', label: 'Johannesburg' },
] as const

export const DATHOST_LOCATION_IDS = DATHOST_LOCATIONS.map((location) => location.id)

export type DathostLocationId = (typeof DATHOST_LOCATIONS)[number]['id']
export type MapSelectionModeId = (typeof MAP_SELECTION_MODES)[number]['id']
export type StartModeId = (typeof START_MODES)[number]['id']
export type PrivacyModeId = (typeof PRIVACY_MODES)[number]['id']

export function resolveDathostLocation(location: string): string {
  return location
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
export const LOBBY_CODE_LENGTH = 6
export const READY_CHECK_SECONDS = 10
