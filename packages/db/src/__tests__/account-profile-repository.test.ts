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

describe('account profile repository', () => {
  it('translates only the profile username constraint race', async () => {
    const repository = createAccountProfileRepository(
      rejectingDb({ code: '23505', constraint: 'profiles_username_key' })
    )

    await expect(
      repository.upsertForUser('user-1', {
        username: 'taken_name',
        name: null,
        bio: null
      })
    ).rejects.toBeInstanceOf(UsernameConflictError)
  })
})
