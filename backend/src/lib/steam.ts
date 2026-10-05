import { env } from '../config/env'
import { BadRequestError } from './errors'

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const STEAM_ID_REGEX = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/

export type SteamProfile = {
  steamId64: string
  username: string
  avatarUrl: string
  profileUrl: string
}

export function buildSteamLoginUrl(returnTo: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': env.PUBLIC_URL,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })

  return `${STEAM_OPENID_URL}?${params.toString()}`
}

export async function verifySteamOpenId(query: Record<string, string>): Promise<string> {
  const claimedId = query['openid.claimed_id']
  if (!claimedId) {
    throw new BadRequestError('Missing Steam claimed_id')
  }

  const match = claimedId.match(STEAM_ID_REGEX)
  if (!match?.[1]) {
    throw new BadRequestError('Invalid Steam claimed_id')
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value)
  }
  params.set('openid.mode', 'check_authentication')

  const response = await fetch(STEAM_OPENID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const body = await response.text()
  if (!body.includes('is_valid:true')) {
    throw new BadRequestError('Steam OpenID verification failed')
  }

  return match[1]
}

export async function fetchSteamProfile(steamId64: string): Promise<SteamProfile> {
  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/')
  url.searchParams.set('key', env.STEAM_API_KEY)
  url.searchParams.set('steamids', steamId64)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Steam API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    response: {
      players: Array<{
        steamid: string
        personaname: string
        avatarfull: string
        profileurl: string
      }>
    }
  }

  const player = data.response.players[0]
  if (!player) {
    throw new BadRequestError('Steam profile not found')
  }

  return {
    steamId64: player.steamid,
    username: player.personaname,
    avatarUrl: player.avatarfull,
    profileUrl: player.profileurl,
  }
}
