import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  completeInvitation: vi.fn(),
  updateUser: vi.fn()
}))

vi.mock('../lib/api', () => ({
  api: {
    account: {
      completeInvitation: mocks.completeInvitation
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
    mocks.completeInvitation.mockResolvedValue({ ok: true })
    mocks.updateUser.mockResolvedValue({ error: null })
  })

  it('completes invitations through the authenticated API boundary', async () => {
    await expect(
      browserAuthClient.completeInvitation({
        username: 'morgan',
        password: 'new-password-123'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.completeInvitation).toHaveBeenCalledWith({
      password: 'new-password-123',
      username: 'morgan'
    })
    expect(mocks.updateUser).not.toHaveBeenCalled()
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

  it('returns server-enforced username policy failures', async () => {
    mocks.completeInvitation.mockRejectedValue(new Error('That username is already taken.'))

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
})
