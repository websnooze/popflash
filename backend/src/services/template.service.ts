import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { lobbyTemplates, type LobbyTemplateSettings } from '../db/schema'
import { NotFoundError, ForbiddenError } from '../lib/errors'
import { saveTemplateSchema, type SaveTemplateInput } from '../lib/lobby-settings'
import type { AuthUser } from '../types/hono'

export type LobbyTemplateView = {
  id: string
  name: string
  settings: LobbyTemplateSettings
  createdAt: Date
  updatedAt: Date
}

export class TemplateService {
  async list(userId: string): Promise<LobbyTemplateView[]> {
    const rows = await db.query.lobbyTemplates.findMany({
      where: eq(lobbyTemplates.userId, userId),
      orderBy: [desc(lobbyTemplates.updatedAt)],
    })

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      settings: row.settings,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  }

  async save(user: AuthUser, input: SaveTemplateInput): Promise<LobbyTemplateView> {
    const parsed = saveTemplateSchema.parse(input)
    const [row] = await db
      .insert(lobbyTemplates)
      .values({
        userId: user.id,
        name: parsed.name,
        settings: parsed.settings,
      })
      .returning()

    return {
      id: row!.id,
      name: row!.name,
      settings: row!.settings,
      createdAt: row!.createdAt,
      updatedAt: row!.updatedAt,
    }
  }

  async remove(user: AuthUser, templateId: string): Promise<void> {
    const existing = await db.query.lobbyTemplates.findFirst({
      where: and(eq(lobbyTemplates.id, templateId), eq(lobbyTemplates.userId, user.id)),
    })
    if (!existing) throw new NotFoundError('Template not found')

    await db.delete(lobbyTemplates).where(eq(lobbyTemplates.id, templateId))
  }

  async getOwned(userId: string, templateId: string): Promise<LobbyTemplateView> {
    const row = await db.query.lobbyTemplates.findFirst({
      where: and(eq(lobbyTemplates.id, templateId), eq(lobbyTemplates.userId, userId)),
    })
    if (!row) throw new NotFoundError('Template not found')
    return {
      id: row.id,
      name: row.name,
      settings: row.settings,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  assertOwner(userId: string, templateUserId: string) {
    if (userId !== templateUserId) throw new ForbiddenError()
  }
}

export const templateService = new TemplateService()
