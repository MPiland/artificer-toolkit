import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkVerificationOtp: vi.fn(),
  fetch: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signInEmail: vi.fn(),
  signInUsername: vi.fn(),
  signOut: vi.fn(),
  signUpEmail: vi.fn(),
  clearPrivateContent: vi.fn(async () => undefined)
}))

vi.mock('#app/data/contentSnapshots/privateContent', () => ({
  clearPrivateContentSnapshots: mocks.clearPrivateContent
}))

vi.mock('./betterAuthClient', () => ({
  betterAuthClient: {
    $fetch: mocks.fetch,
    emailOtp: {
      checkVerificationOtp: mocks.checkVerificationOtp,
      requestPasswordReset: mocks.requestPasswordReset,
      resetPassword: mocks.resetPassword
    },
    signIn: { email: mocks.signInEmail, username: mocks.signInUsername },
    signOut: mocks.signOut,
    signUp: { email: mocks.signUpEmail }
  }
}))

import { browserAuthClient } from './authClient'

describe('browserAuthClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch.mockResolvedValue({ data: { success: true }, error: null })
    mocks.checkVerificationOtp.mockResolvedValue({
      data: { success: true },
      error: null
    })
    mocks.requestPasswordReset.mockResolvedValue({
      data: { success: true },
      error: null
    })
    mocks.resetPassword.mockResolvedValue({
      data: { success: true },
      error: null
    })
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null })
    mocks.signInUsername.mockResolvedValue({ data: {}, error: null })
    mocks.signOut.mockResolvedValue({ data: {}, error: null })
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null })
  })

  it('redeems invitations through Better Auth without tRPC', async () => {
    await expect(
      browserAuthClient.completeInvitation({
        email: 'PLAYER@example.com',
        password: 'new-password-123',
        token: 'a'.repeat(64),
        username: 'player_one'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.fetch).toHaveBeenCalledWith('/invitation/redeem', {
      body: {
        email: 'player@example.com',
        password: 'new-password-123',
        token: 'a'.repeat(64),
        username: 'player_one'
      },
      method: 'POST'
    })
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects malformed invitation credentials before calling Better Auth', async () => {
    await expect(
      browserAuthClient.completeInvitation({
        email: 'player@example.com',
        password: 'new-password-123',
        token: 'invalid',
        username: 'player_one'
      })
    ).resolves.toMatchObject({ ok: false })

    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('signs in email identifiers with Better Auth', async () => {
    await expect(
      browserAuthClient.signIn({
        identifier: 'player@example.com',
        password: 'password1234'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'password1234'
    })
    expect(mocks.signInUsername).not.toHaveBeenCalled()
  })

  it('signs in username identifiers without exposing the account email', async () => {
    await expect(
      browserAuthClient.signIn({
        identifier: 'player_one',
        password: 'password1234'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.signInUsername).toHaveBeenCalledWith({
      username: 'player_one',
      password: 'password1234'
    })
    expect(mocks.signInEmail).not.toHaveBeenCalled()
  })

  it('reports username sign-in rate limits without treating them as bad credentials', async () => {
    mocks.signInUsername.mockRejectedValueOnce({ status: 429 })

    await expect(
      browserAuthClient.signIn({
        identifier: 'player_one',
        password: 'password1234'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Too many sign-in attempts. Try again shortly.'
    })
  })

  it.each(['player@example.com', 'player_one'])(
    'offers verification recovery only after a valid-password denial: %s',
    async (identifier) => {
      const signIn = identifier.includes('@') ? mocks.signInEmail : mocks.signInUsername
      signIn.mockResolvedValueOnce({
        error: {
          status: 403,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Private provider details'
        }
      })
      await expect(
        browserAuthClient.signIn({ identifier, password: 'password1234' })
      ).resolves.toEqual({
        ok: false,
        message:
          'Confirm your email before signing in. Check your inbox for a new confirmation link.'
      })
      for (const error of [
        { status: 401, code: 'EMAIL_NOT_VERIFIED' },
        { status: 403, code: 'UNKNOWN_ERROR' }
      ]) {
        signIn.mockResolvedValueOnce({ error })
        await expect(
          browserAuthClient.signIn({ identifier, password: 'password1234' })
        ).resolves.toEqual({
          ok: false,
          message: 'Check your email or username and password, then try again.'
        })
      }
    }
  )

  it('returns generic Better Auth failures without exposing details', async () => {
    mocks.signInEmail.mockResolvedValueOnce({
      error: { status: 401, message: 'Detailed failure' }
    })
    mocks.signUpEmail.mockResolvedValueOnce({
      error: { status: 400, message: 'Detailed failure' }
    })

    await expect(
      browserAuthClient.signIn({
        identifier: 'player@example.com',
        password: 'password1234'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Check your email or username and password, then try again.'
    })
    await expect(
      browserAuthClient.signUp({
        email: 'player@example.com',
        password: 'password1234',
        username: 'player_one'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Could not create your account. Try again.'
    })
  })

  it('verifies password recovery with the emailed OTP', async () => {
    await expect(
      browserAuthClient.verifyPasswordRecovery({
        email: ' player@example.com ',
        token: '123456'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.checkVerificationOtp).toHaveBeenCalledWith({
      email: 'player@example.com',
      otp: '123456',
      type: 'forget-password'
    })
  })

  it('rejects malformed password recovery codes before calling Better Auth', async () => {
    await expect(
      browserAuthClient.verifyPasswordRecovery({
        email: 'player@example.com',
        token: '12345'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Enter the six-digit verification code.'
    })

    expect(mocks.checkVerificationOtp).not.toHaveBeenCalled()
  })

  it('uses Better Auth for signup and password reset commands', async () => {
    await browserAuthClient.signUp({
      email: 'player@example.com',
      password: 'password1234',
      username: 'player_one'
    })
    await browserAuthClient.requestPasswordReset({
      email: 'player@example.com'
    })
    await browserAuthClient.resetPassword({
      email: 'player@example.com',
      token: '123456',
      password: 'new-password-123'
    })

    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      email: 'player@example.com',
      name: 'player_one',
      password: 'password1234',
      username: 'player_one'
    })
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: 'player@example.com'
    })
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      otp: '123456',
      password: 'new-password-123'
    })
  })

  it('rejects invalid new passwords before calling Better Auth', async () => {
    await expect(
      browserAuthClient.resetPassword({
        email: 'player@example.com',
        token: '123456',
        password: 'too-short'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Use at least 12 characters for your password.'
    })
    await expect(
      browserAuthClient.resetPassword({
        email: 'player@example.com',
        token: '123456',
        password: 'p'.repeat(129)
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Use no more than 128 characters for your password.'
    })

    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('returns generic invitation redemption failures', async () => {
    mocks.fetch.mockResolvedValue({ data: null, error: { status: 400 } })

    await expect(
      browserAuthClient.completeInvitation({
        email: 'player@example.com',
        password: 'new-password-123',
        token: 'a'.repeat(64),
        username: 'player_one'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Could not complete registration.'
    })
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('clears private content snapshots only after a successful sign-out', async () => {
    mocks.signOut.mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    await expect(browserAuthClient.signOut()).resolves.toMatchObject({ ok: false })
    expect(mocks.clearPrivateContent).not.toHaveBeenCalled()

    await expect(browserAuthClient.signOut()).resolves.toEqual({ ok: true })
    expect(mocks.clearPrivateContent).toHaveBeenCalledOnce()
  })
})
