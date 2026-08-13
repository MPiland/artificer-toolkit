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
  campaignSelect: vi.fn(),
  campaignEq: vi.fn(),
  campaignLimit: vi.fn(),
  campaignMaybeSingle: vi.fn()
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
    vi.clearAllMocks()
    mocks.createClient.mockReturnValue({
      auth: { signInWithPassword: mocks.signInWithPassword }
    })
    mocks.getBlockedAuthRequest.mockReturnValue(null)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'campaigns') return { select: mocks.campaignSelect }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.campaignSelect.mockReturnValue({ eq: mocks.campaignEq })
    mocks.campaignEq.mockReturnValue({ limit: mocks.campaignLimit })
    mocks.campaignLimit.mockReturnValue({ maybeSingle: mocks.campaignMaybeSingle })
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
    mocks.campaignMaybeSingle.mockResolvedValue({ data: null, error: null })
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
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: input.email,
      password: input.currentPassword
    })
    expect(mocks.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('does not delete an account while it owns a Campaign', async () => {
    mocks.campaignMaybeSingle.mockResolvedValueOnce({
      data: { id: 'campaign-1' },
      error: null
    })

    await expect(deleteAccountFn({ data: input })).resolves.toEqual({
      error: true,
      message: 'Transfer or delete your Campaigns before deleting your account.'
    })
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })

  it('does not delete an account when Campaign ownership cannot be checked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.campaignMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('sensitive database detail')
    })

    await expect(deleteAccountFn({ data: input })).resolves.toEqual({
      error: true,
      message: 'Could not delete your account. Try again.'
    })
    expect(mocks.deleteUser).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('Account deletion eligibility lookup failed.')
    consoleError.mockRestore()
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
