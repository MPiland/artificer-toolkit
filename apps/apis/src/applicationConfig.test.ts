import { describe, expect, it } from 'vitest'
import { getApplicationFeatureFlags, parsePublicSignUpEnabled } from './applicationConfig.js'

describe('application feature flags', () => {
  it('enables public sign-up only for the exact supported true value', () => {
    expect(parsePublicSignUpEnabled('true')).toBe(true)
  })

  it.each([undefined, '', 'false', 'TRUE', ' true ', 'enabled'])(
    'disables public sign-up for %j',
    (value) => {
      expect(parsePublicSignUpEnabled(value)).toBe(false)
    }
  )

  it('exposes typed flags with a secure default', () => {
    expect(getApplicationFeatureFlags({})).toEqual({ publicSignUpEnabled: false })
  })
})
