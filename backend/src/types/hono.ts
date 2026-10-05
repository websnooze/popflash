import type { User } from '../db/schema'

export type AuthUser = Pick<User, 'id' | 'steamId64' | 'username' | 'avatarUrl' | 'profileUrl'>

export type AppVariables = {
  user: AuthUser | null
}

export type AppEnv = {
  Variables: AppVariables
}
