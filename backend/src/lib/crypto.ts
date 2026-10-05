import { createHash, randomBytes } from 'node:crypto'
import { customAlphabet } from 'nanoid'
import { LOBBY_CODE_LENGTH } from './constants'

const lobbyCodeAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', LOBBY_CODE_LENGTH)

export function generateLobbyCode(): string {
  return lobbyCodeAlphabet()
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateMatchPassword(): string {
  return randomBytes(4).toString('hex')
}

export function generateRconPassword(): string {
  return randomBytes(12).toString('hex')
}

export function generateInviteToken(): string {
  return randomBytes(16).toString('base64url')
}
