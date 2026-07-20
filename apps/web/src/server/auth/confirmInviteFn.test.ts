import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  verifyOtp: vi.fn()
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: <TResult>(callback: (context: { data: unknown }) => TResult) => callback
    })
  })
}))

vi.mock('#supabase/server.server', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient
}))

import { confirmInviteFn } from './confirmInviteFn'

describe('confirmInviteFn', () => {
  it('verifies the Supabase invite token before password setup', async () => {
    mocks.getSupabaseServerClient.mockReturnValue({
      auth: {
        verifyOtp: mocks.verifyOtp
      }
    })
    mocks.verifyOtp.mockResolvedValue({ error: null })

    await expect(confirmInviteFn({ data: { tokenHash: 'invite-token' } })).resolves.toEqual({
      ok: true
    })
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'invite-token',
      type: 'invite'
    })
  })

  it('returns a safe error for expired or invalid invitation links', async () => {
    mocks.getSupabaseServerClient.mockReturnValue({
      auth: {
        verifyOtp: mocks.verifyOtp
      }
    })
    mocks.verifyOtp.mockResolvedValue({ error: new Error('expired') })

    await expect(confirmInviteFn({ data: { tokenHash: 'expired-token' } })).resolves.toEqual({
      ok: false,
      message: 'This invitation link is invalid or has expired.'
    })
  })
})
