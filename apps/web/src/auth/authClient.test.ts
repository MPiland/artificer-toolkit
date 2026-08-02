import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  updateProfile: vi.fn(),
  updateUser: vi.fn(),
  usernameStatus: vi.fn()
}))

vi.mock('../lib/api', () => ({
  api: {
    account: {
      profile: mocks.profile,
      updateProfile: mocks.updateProfile,
      usernameStatus: mocks.usernameStatus
    }
  }
}))
vi.mock('../supabase/client', () => ({
  getSupabaseBrowserClient: () => ({ auth: { updateUser: mocks.updateUser } })
}))
vi.mock('../server/auth/signUpFn', () => ({
  signUpFn: vi.fn()
}))

import { browserAuthClient } from './authClient'

describe('browserAuthClient password updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profile.mockResolvedValue(null)
    mocks.usernameStatus.mockResolvedValue({ status: 'available' })
    mocks.updateUser.mockResolvedValue({ error: null })
    mocks.updateProfile.mockResolvedValue({
      username: 'morgan',
      name: null,
      bio: null
    })
  })

  it('updates the password before creating the required profile', async () => {
    await expect(
      browserAuthClient.completeInvitation({
        username: 'morgan',
        password: 'new-password-123'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' })
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      username: 'morgan',
      name: null,
      bio: null
    })
    expect(mocks.updateUser.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.updateProfile.mock.invocationCallOrder[0]!
    )
  })

  it('rejects invalid new passwords before calling Supabase', async () => {
    await expect(browserAuthClient.updatePassword({ password: 'too-short' })).resolves.toEqual({
      ok: false,
      message: 'Use at least 12 characters for your password.'
    })
    await expect(browserAuthClient.updatePassword({ password: 'p'.repeat(129) })).resolves.toEqual({
      ok: false,
      message: 'Use no more than 128 characters for your password.'
    })

    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('does not change the password when the username is unavailable', async () => {
    mocks.usernameStatus.mockResolvedValue({ status: 'taken' })

    await expect(
      browserAuthClient.completeInvitation({
        username: 'taken_name',
        password: 'new-password-123'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'That username is already taken.'
    })
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('returns a post-password username conflict so the invitation can be retried', async () => {
    mocks.updateProfile.mockRejectedValue(new Error('That username is already taken.'))

    await expect(
      browserAuthClient.completeInvitation({
        username: 'raced_name',
        password: 'new-password-123'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'That username is already taken.'
    })
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' })
  })

  it('does not erase optional profile fields if invitation completion is revisited', async () => {
    mocks.profile.mockResolvedValue({
      username: 'morgan',
      name: 'Morgan',
      bio: 'Forge keeper.'
    })

    await browserAuthClient.completeInvitation({
      username: 'morgan_new',
      password: 'new-password-123'
    })

    expect(mocks.updateProfile).toHaveBeenCalledWith({
      username: 'morgan_new',
      name: 'Morgan',
      bio: 'Forge keeper.'
    })
  })
})
