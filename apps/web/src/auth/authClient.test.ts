import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  completeInvitation: vi.fn(),
  setSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithUsername: vi.fn(),
  updateUser: vi.fn()
}))

vi.mock('../lib/api', () => ({
  api: {
    account: {
      completeInvitation: mocks.completeInvitation,
      signInWithUsername: mocks.signInWithUsername
    }
  }
}))
vi.mock('../supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      setSession: mocks.setSession,
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser
    }
  })
}))
vi.mock('../server/auth/signUpFn', () => ({
  signUpFn: vi.fn()
}))

import { browserAuthClient } from './authClient'

describe('browserAuthClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.completeInvitation.mockResolvedValue({ ok: true })
    mocks.setSession.mockResolvedValue({ data: { session: { id: 'session' } }, error: null })
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { id: 'email-session' } },
      error: null
    })
    mocks.signInWithUsername.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    })
    mocks.updateUser.mockResolvedValue({ error: null })
  })

  it('completes invitations through the authenticated API boundary', async () => {
    await expect(
      browserAuthClient.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.completeInvitation).toHaveBeenCalledWith({
      password: 'new-password-123',
      username: 'player_one'
    })
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('signs in email identifiers directly with Supabase', async () => {
    await expect(
      browserAuthClient.signIn({
        identifier: 'player@example.com',
        password: 'password1234'
      })
    ).resolves.toEqual({ ok: true, session: { id: 'email-session' } })

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'password1234'
    })
    expect(mocks.signInWithUsername).not.toHaveBeenCalled()
  })

  it('signs in username identifiers without exposing the account email', async () => {
    await expect(
      browserAuthClient.signIn({ identifier: 'player_one', password: 'password1234' })
    ).resolves.toEqual({ ok: true, session: { id: 'session' } })

    expect(mocks.signInWithUsername).toHaveBeenCalledWith({
      username: 'player_one',
      password: 'password1234'
    })
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token'
    })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('reports username sign-in rate limits without treating them as bad credentials', async () => {
    mocks.signInWithUsername.mockRejectedValueOnce({ status: 429 })

    await expect(
      browserAuthClient.signIn({ identifier: 'player_one', password: 'password1234' })
    ).resolves.toEqual({
      ok: false,
      message: 'Too many sign-in attempts. Try again shortly.'
    })
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

  it('returns server-enforced invitation completion failures', async () => {
    mocks.completeInvitation.mockRejectedValue(new Error('Could not complete registration.'))

    await expect(
      browserAuthClient.completeInvitation({
        password: 'new-password-123',
        username: 'player_one'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Could not complete registration.'
    })
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
})
