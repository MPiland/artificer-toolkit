import { describe, expect, it } from 'vitest'
import { hasPendingInvitationSetup } from './invitationStatus'

describe('invitation status', () => {
  it('requires password setup only for unfinished invited users', () => {
    expect(hasPendingInvitationSetup({ registrationCompleted: false })).toBe(true)
    expect(hasPendingInvitationSetup({ registrationCompleted: true })).toBe(false)
  })
})
