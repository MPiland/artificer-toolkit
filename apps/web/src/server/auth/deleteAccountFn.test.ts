import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteUser: vi.fn(),
  getBlockedAuthRequest: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  novuDelete: vi.fn(),
  NovuError: class NovuError extends Error {
    statusCode: number

    constructor(status: number) {
      super(`HTTP ${status}`)
      this.statusCode = status
    }
  }
}))

vi.mock('@novu/api', () => {
  class MockNovu {
    subscribers = { delete: mocks.novuDelete }
  }
  return { Novu: MockNovu }
})

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
  const recipientId = '00000000-0000-4000-8000-000000000001'

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockReturnValue({
      auth: { signInWithPassword: mocks.signInWithPassword }
    })
    mocks.getBlockedAuthRequest.mockReturnValue(null)
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle })
    mocks.getSupabaseAdminClient.mockReturnValue({
      from: mocks.from,
      auth: { admin: { deleteUser: mocks.deleteUser } }
    })
    mocks.getSupabaseServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser }
    })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: input.email } },
      error: null
    })
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.deleteUser.mockResolvedValue({ error: null })
    mocks.maybeSingle.mockResolvedValue({
      data: { notification_recipient_id: recipientId },
      error: null
    })
    vi.stubEnv('NOVU_SECRET_KEY', 'novu-secret')
    mocks.novuDelete.mockResolvedValue(undefined)
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

  it('permanently deletes the verified user', async () => {
    await expect(deleteAccountFn({ data: input })).resolves.toEqual({ ok: true })
    expect(mocks.novuDelete).toHaveBeenCalledWith(recipientId)

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: input.email,
      password: input.currentPassword
    })
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('blocks Supabase deletion when Novu cleanup fails', async () => {
    mocks.novuDelete.mockRejectedValueOnce(new mocks.NovuError(503))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(deleteAccountFn({ data: input })).resolves.toEqual({
      error: true,
      message: 'Could not delete your account. Try again.'
    })
    expect(mocks.deleteUser).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('continues Supabase deletion when Novu already deleted the recipient', async () => {
    mocks.novuDelete.mockRejectedValueOnce(new mocks.NovuError(404))

    await expect(deleteAccountFn({ data: input })).resolves.toEqual({ ok: true })
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('does not expose admin deletion details to the browser', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.deleteUser.mockResolvedValue({ error: new Error('sensitive provider detail') })

    await expect(deleteAccountFn({ data: input })).resolves.toEqual({
      error: true,
      message: 'Could not delete your account. Try again.'
    })
    expect(consoleError).toHaveBeenCalledWith('Account deletion failed.', expect.any(Error))
    consoleError.mockRestore()
  })
})
