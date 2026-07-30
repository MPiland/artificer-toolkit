import { sql } from 'kysely'
import type { DBLike } from '#types'

export interface AccountProfile {
  username: string
  name: string | null
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

    async findForUser(userId: string): Promise<AccountProfile | null> {
      const profile = await db
        .selectFrom('profiles')
        .select(['username', 'full_name', 'bio'])
        .where('id', '=', userId)
        .executeTakeFirst()

      if (!profile) return null
      if (profile.username === null) {
        throw new Error(`Profile for user "${userId}" has no username.`)
      }

      return {
        username: profile.username,
        name: profile.full_name,
        bio: profile.bio
      }
    },

    async upsertForUser(userId: string, profile: AccountProfile): Promise<AccountProfile> {
      const updatedAt = new Date().toISOString()

      try {
        await db
          .insertInto('profiles')
          .values({
            id: userId,
            username: profile.username,
            full_name: profile.name,
            bio: profile.bio,
            updated_at: updatedAt
          })
          .onConflict((conflict) =>
            conflict.column('id').doUpdateSet((expressionBuilder) => ({
              username: expressionBuilder.ref('excluded.username'),
              full_name: expressionBuilder.ref('excluded.full_name'),
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
