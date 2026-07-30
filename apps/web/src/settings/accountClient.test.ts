import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn()
}))

vi.mock('#supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser
    }
  })
}))
vi.mock('#app/server/auth/deleteAccountFn', () => ({
  deleteAccountFn: mocks.deleteAccount
}))

import { accountClient } from './accountClient'

describe('account client', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation errors without calling Supabase', async () => {
    const result = await accountClient.updateEmail({ email: 'not-an-email' })

    expect(result.ok).toBe(false)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('reauthenticates before changing passwords', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.updateUser.mockResolvedValue({ error: null })

    await accountClient.updatePassword({
      email: 'player@example.com',
      currentPassword: 'current-password',
      password: 'new-password'
    })

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'current-password'
    })
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: 'new-password'
    })
  })

  it('does not update the password when reauthentication fails', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('Invalid credentials') })

    const result = await accountClient.updatePassword({
      email: 'player@example.com',
      currentPassword: 'wrong-password',
      password: 'new-password'
    })

    expect(result).toEqual({ ok: false, message: 'Your current password is incorrect.' })
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('returns email confirmations to account settings without signing out', async () => {
    mocks.updateUser.mockResolvedValue({ error: null })

    await accountClient.updateEmail({ email: 'new@example.com' })

    expect(mocks.updateUser).toHaveBeenCalledWith(
      { email: 'new@example.com' },
      {
        emailRedirectTo: `${window.location.origin}/settings/account?emailChanged=1`
      }
    )
  })
})
