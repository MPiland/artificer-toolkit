import { describe, expect, it, vi } from 'vitest'
import type { DBLike } from '../types/index.js'
import {
  UsernameConflictError,
  createAccountProfileRepository
} from '../repositories/accountProfile.js'

function rejectingDb(error: unknown): DBLike {
  const executeTakeFirstOrThrow = vi.fn().mockRejectedValue(error)

  return {
    insertInto: () => ({
      values: () => ({
        onConflict: () => ({ executeTakeFirstOrThrow })
      })
    })
  } as unknown as DBLike
}

function profileDb(username: string | null): DBLike {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: async () => ({ username, bio: null })
        })
      })
    })
  } as unknown as DBLike
}

describe('account profile repository', () => {
  it('returns profiles without requiring a username', async () => {
    const repository = createAccountProfileRepository(profileDb(null))

    await expect(repository.findForUser('user-1')).resolves.toEqual({
      username: null,
      bio: null
    })
  })

  it('translates only the profile username constraint race', async () => {
    const repository = createAccountProfileRepository(
      rejectingDb({ code: '23505', constraint: 'profiles_username_key' })
    )

    await expect(
      repository.upsertForUser('user-1', {
        username: 'taken_name',
        bio: null
      })
    ).rejects.toBeInstanceOf(UsernameConflictError)
  })
})
