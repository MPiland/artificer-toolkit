import { describe, expect, it } from 'vitest'
import { hasPendingInvitationSetup } from './invitationStatus'

describe('invitation status', () => {
  it('requires password setup only for unfinished invited users', () => {
    expect(
      hasPendingInvitationSetup({ invited_at: '2026-08-05T12:00:00Z', app_metadata: {} })
    ).toBe(true)
    expect(
      hasPendingInvitationSetup({
        invited_at: '2026-08-05T12:00:00Z',
        app_metadata: { registration_completed: true }
      })
    ).toBe(false)
    expect(hasPendingInvitationSetup({ app_metadata: {} })).toBe(false)
  })
})
