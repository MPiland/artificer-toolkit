import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn()
}))

vi.mock('#app/auth/betterAuthClient', () => ({
  betterAuthClient: { $fetch: mocks.fetch }
}))

import { accountClient } from './accountClient'

describe('account client', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns email validation errors without making an auth request', async () => {
    const result = await accountClient.updateEmail({ email: 'not-an-email' })

    expect(result.ok).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('returns validation errors without making a password request', async () => {
    const result = await accountClient.updatePassword({
      email: 'not-an-email',
      currentPassword: 'current-password',
      password: 'new-password'
    })

    expect(result.ok).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('updates passwords through Better Auth with the validated body', async () => {
    mocks.fetch.mockResolvedValue({ data: null, error: null })

    const result = await accountClient.updatePassword({
      email: 'player@example.com',
      currentPassword: 'current-password',
      password: 'new-password'
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('/account/password', {
      method: 'POST',
      body: {
        email: 'player@example.com',
        currentPassword: 'current-password',
        password: 'new-password'
      }
    })
  })

  it('normalizes invalid current passwords', async () => {
    mocks.fetch.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_PASSWORD', message: 'Sensitive backend detail' }
    })

    const result = await accountClient.updatePassword({
      email: 'player@example.com',
      currentPassword: 'wrong-password',
      password: 'new-password'
    })

    expect(result).toEqual({ ok: false, message: 'Your current password is incorrect.' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns another Better Auth error message', async () => {
    mocks.fetch.mockResolvedValue({
      data: null,
      error: { code: 'PASSWORD_UPDATE_FAILED', message: 'Password update failed.' }
    })

    await expect(
      accountClient.updatePassword({
        email: 'player@example.com',
        currentPassword: 'current-password',
        password: 'new-password'
      })
    ).resolves.toEqual({ ok: false, message: 'Password update failed.' })
  })

  it('returns a generic message when the password request rejects', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network failure'))

    await expect(
      accountClient.updatePassword({
        email: 'player@example.com',
        currentPassword: 'current-password',
        password: 'new-password'
      })
    ).resolves.toEqual({ ok: false, message: 'Could not update your password. Try again.' })
  })

  it('requests native email confirmation with the validated address and account-settings callback', async () => {
    mocks.fetch.mockResolvedValue({ data: { status: true }, error: null })

    await expect(accountClient.updateEmail({ email: ' new@example.com ' })).resolves.toEqual({
      ok: true
    })

    expect(mocks.fetch).toHaveBeenCalledWith('/change-email', {
      method: 'POST',
      body: {
        newEmail: 'new@example.com',
        callbackURL: `${window.location.origin}/settings/account?emailChanged=1`
      }
    })
  })

  it('returns native email errors without making a legacy request', async () => {
    mocks.fetch.mockResolvedValue({
      data: null,
      error: { code: 'CHANGE_EMAIL_FAILED', message: 'Email change failed.' }
    })

    await expect(accountClient.updateEmail({ email: 'new@example.com' })).resolves.toEqual({
      ok: false,
      message: 'Email change failed.'
    })
  })

  it('returns a generic message when the native email request rejects', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network failure'))

    await expect(accountClient.updateEmail({ email: 'new@example.com' })).resolves.toEqual({
      ok: false,
      message: 'Could not update your email. Try again.'
    })
  })

  it('returns deletion validation errors without making an auth request', async () => {
    await expect(
      accountClient.deleteAccount({ email: 'not-an-email', currentPassword: '' })
    ).resolves.toEqual({ ok: false, message: 'Invalid email address' })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('deletes through Better Auth with the validated body', async () => {
    mocks.fetch.mockResolvedValue({ data: null, error: null })

    await expect(
      accountClient.deleteAccount({
        email: ' player@example.com ',
        currentPassword: 'current-password'
      })
    ).resolves.toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('/account/delete', {
      method: 'POST',
      body: { email: 'player@example.com', currentPassword: 'current-password' }
    })
  })

  it('returns the native deletion refusal message', async () => {
    mocks.fetch.mockResolvedValue({
      data: null,
      error: { code: 'DELETE_REFUSED', message: 'Confirm your current password.' }
    })

    await expect(
      accountClient.deleteAccount({
        email: 'player@example.com',
        currentPassword: 'current-password'
      })
    ).resolves.toEqual({ ok: false, message: 'Confirm your current password.' })
  })

  it('normalizes native deletion refusals without a message', async () => {
    mocks.fetch.mockResolvedValue({ data: null, error: { code: 'DELETE_REFUSED' } })

    await expect(
      accountClient.deleteAccount({
        email: 'player@example.com',
        currentPassword: 'current-password'
      })
    ).resolves.toEqual({ ok: false, message: 'Could not delete your account. Try again.' })
  })

  it('returns a generic message when the deletion request rejects', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network failure'))

    await expect(
      accountClient.deleteAccount({
        email: 'player@example.com',
        currentPassword: 'current-password'
      })
    ).resolves.toEqual({ ok: false, message: 'Could not delete your account. Try again.' })
  })
})
