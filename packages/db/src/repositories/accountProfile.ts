import { sql } from 'kysely'
import type { DBLike } from '#types'

export interface AccountProfile {
  username: string | null
  bio: string | null
}

export class UsernameConflictError extends Error {
  constructor() {
    super('That username is already taken.')
    this.name = 'UsernameConflictError'
  }
}

function isUsernameUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const { code, constraint } = error as { code?: unknown; constraint?: unknown }
  return code === '23505' && constraint === 'profiles_username_key'
}

export function createAccountProfileRepository(db: DBLike) {
  return {
    async isUsernameTaken(username: string): Promise<boolean> {
      const profile = await db
        .selectFrom('profiles')
        .select('id')
        .where(sql<string>`lower(username)`, '=', username.toLowerCase())
        .executeTakeFirst()

      return Boolean(profile)
    },

    async findUserIdByUsername(username: string): Promise<string | null> {
      const profile = await db
        .selectFrom('profiles')
        .select('id')
        .where(sql<string>`lower(username)`, '=', username.toLowerCase())
        .executeTakeFirst()

      return profile?.id ?? null
    },

    async findForUser(userId: string): Promise<AccountProfile | null> {
      const profile = await db
        .selectFrom('profiles')
        .select(['username', 'bio'])
        .where('id', '=', userId)
        .executeTakeFirst()

      if (!profile) return null

      return {
        username: profile.username,
        bio: profile.bio
      }
    },

    async upsertForUser(
      userId: string,
      profile: { username: string; bio: string | null }
    ): Promise<AccountProfile> {
      const updatedAt = new Date().toISOString()

      try {
        await db
          .insertInto('profiles')
          .values({
            id: userId,
            username: profile.username,
            bio: profile.bio,
            updated_at: updatedAt
          })
          .onConflict((conflict) =>
            conflict.column('id').doUpdateSet((expressionBuilder) => ({
              username: expressionBuilder.ref('excluded.username'),
              bio: expressionBuilder.ref('excluded.bio'),
              updated_at: expressionBuilder.ref('excluded.updated_at')
            }))
          )
          .executeTakeFirstOrThrow()
      } catch (error) {
        if (isUsernameUniqueViolation(error)) {
          throw new UsernameConflictError()
        }

        throw error
      }

      return profile
    }
  }
}
