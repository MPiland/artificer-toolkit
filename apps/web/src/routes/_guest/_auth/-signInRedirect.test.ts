import { describe, expect, it } from 'vitest'
import { isSafeSignInRedirect, signInRedirectSearchSchema } from './-signInRedirect'

describe('sign-in redirects', () => {
  it('accepts a local path', () => {
    expect(isSafeSignInRedirect('/home')).toBe(true)
    expect(signInRedirectSearchSchema.parse({ redirect: '/home' })).toEqual({ redirect: '/home' })
  })

  it.each(['//evil.example', '\\evil.example', '/\\evil.example', '/%5Cevil.example'])(
    'rejects %s',
    (redirect) => {
      expect(isSafeSignInRedirect(redirect)).toBe(false)
      expect(signInRedirectSearchSchema.safeParse({ redirect }).success).toBe(false)
    }
  )
})
