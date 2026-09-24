import { describe, expect, it } from 'vitest'
import { shouldRedirectRootToHome } from './_guest/-guestRouteGuards'

describe('guest root route guard', () => {
  it('redirects authenticated users from marketing to home', () => {
    expect(
      shouldRedirectRootToHome({
        userId: 'a74454fc-4f74-4bdb-a47a-194bab7745ac'
      })
    ).toBe(true)
  })

  it('keeps anonymous users on the marketing page', () => {
    expect(shouldRedirectRootToHome(null)).toBe(false)
  })
})
