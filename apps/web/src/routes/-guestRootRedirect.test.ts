import { describe, expect, it } from 'vitest'
import { shouldRedirectRootToHome } from './_guest/-guestRouteGuards'

describe('guest root route guard', () => {
  it('redirects authenticated users from marketing to home', () => {
    expect(
      shouldRedirectRootToHome({
        id: 'user-1'
      })
    ).toBe(true)
  })

  it('keeps anonymous users on the marketing page', () => {
    expect(shouldRedirectRootToHome(null)).toBe(false)
  })
})
