import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  usernameStatus: vi.fn()
}))

vi.mock('../lib/api', () => ({
  api: {
    account: {
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
    mocks.usernameStatus.mockResolvedValue({ status: 'available' })
    mocks.updateUser.mockResolvedValue({ error: null })
  })

  it('submits the password and profile username in one auth update', async () => {
    await expect(
      browserAuthClient.completeInvitation({
        username: 'morgan',
        password: 'new-password-123'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: 'new-password-123',
      data: { username: 'morgan' }
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

  it('does not accept registration when the atomic auth update fails', async () => {
    mocks.updateUser.mockResolvedValue({
      error: {
        code: 'unexpected_failure',
        message: 'Database error updating user.'
      }
    })

    await expect(
      browserAuthClient.completeInvitation({
        username: 'raced_name',
        password: 'new-password-123'
      })
    ).resolves.toEqual({
      ok: false,
      message: 'Database error updating user.'
    })
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
  })

  it('finishes a partially completed invitation when the password is already set', async () => {
    mocks.updateUser
      .mockResolvedValueOnce({
        error: {
          code: 'same_password',
          message: 'New password should be different from the old password.'
        }
      })
      .mockResolvedValueOnce({ error: null })

    await expect(
      browserAuthClient.completeInvitation({
        username: 'morgan',
        password: 'new-password-123'
      })
    ).resolves.toEqual({ ok: true })

    expect(mocks.updateUser).toHaveBeenNthCalledWith(1, {
      password: 'new-password-123',
      data: { username: 'morgan' }
    })
    expect(mocks.updateUser).toHaveBeenNthCalledWith(2, {
      data: { username: 'morgan' }
    })
  })

  it('does not retry other password update errors', async () => {
    mocks.updateUser.mockResolvedValue({
      error: {
        code: 'weak_password',
        message: 'Password does not meet requirements.'
      }
    })

    await expect(
      browserAuthClient.completeInvitation({
        username: 'morgan',
        password: 'new-password-123'
      })
    ).resolves.toEqual({ ok: false, message: 'Password does not meet requirements.' })

    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
  })
})
