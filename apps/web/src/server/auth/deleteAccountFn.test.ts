import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteUser: vi.fn(),
  getBlockedAuthRequest: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: <TResult>(callback: (context: { data: unknown }) => TResult) => callback
    })
  })
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient
}))

vi.mock('#supabase/admin.server', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient
}))

vi.mock('#supabase/server.server', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient
}))

vi.mock('./requestSecurity', () => ({
  getBlockedAuthRequest: mocks.getBlockedAuthRequest
}))

import { deleteAccountFn } from './deleteAccountFn'

describe('deleteAccountFn', () => {
  const input = {
    email: 'player@example.com',
    currentPassword: 'password123'
  }

  beforeEach(() => {
    mocks.createClient.mockReturnValue({
      auth: { signInWithPassword: mocks.signInWithPassword }
    })
    mocks.getBlockedAuthRequest.mockReturnValue(null)
    mocks.getSupabaseAdminClient.mockReturnValue({
      auth: { admin: { deleteUser: mocks.deleteUser } }
    })
    mocks.getSupabaseServerClient.mockReturnValue({
      auth: {
        getUser: mocks.getUser,
        signOut: mocks.signOut
      }
    })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: input.email } },
      error: null
    })
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.deleteUser.mockResolvedValue({ error: null })
  })

  it('requires the exact signed-in account email before password verification', async () => {
    await expect(
      deleteAccountFn({ data: { ...input, email: 'other@example.com' } })
    ).resolves.toEqual({
      error: true,
      message: 'Enter the email address for this account.'
    })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })

  it('revokes sessions before permanently deleting the verified user', async () => {
    await expect(deleteAccountFn({ data: input })).resolves.toEqual({ ok: true })

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: input.email,
      password: input.currentPassword
    })
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-1')
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteUser.mock.invocationCallOrder[0]!
    )
  })

  it('does not expose admin deletion details to the browser', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.deleteUser.mockResolvedValue({ error: new Error('sensitive provider detail') })

    await expect(deleteAccountFn({ data: input })).resolves.toEqual({
      error: true,
      message: 'Could not delete your account. Try again.'
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Account deletion failed after session revocation.',
      expect.any(Error)
    )

    consoleError.mockRestore()
  })
})
