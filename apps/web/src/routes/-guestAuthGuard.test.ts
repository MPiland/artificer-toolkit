import { describe, expect, it } from 'vitest'
import { canAuthenticatedUserVisitGuestAuthPath } from './_guest/_auth'

describe('guest auth route guard', () => {
  it('allows authenticated users to complete password recovery', () => {
    expect(canAuthenticatedUserVisitGuestAuthPath('/update-password')).toBe(true)
  })

  it('keeps other auth routes guest-only', () => {
    expect(canAuthenticatedUserVisitGuestAuthPath('/sign-in')).toBe(false)
    expect(canAuthenticatedUserVisitGuestAuthPath('/sign-up')).toBe(false)
    expect(canAuthenticatedUserVisitGuestAuthPath('/reset-password')).toBe(false)
    expect(canAuthenticatedUserVisitGuestAuthPath('/auth/confirmed')).toBe(false)
  })
})
