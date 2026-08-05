import { describe, expect, it } from 'vitest'
import { getApplicationFeatureFlags, parseEnabledFeatureFlag } from './applicationConfig.js'

describe('application feature flags', () => {
  it('enables public sign-up only for the exact supported true value', () => {
    expect(parseEnabledFeatureFlag('true')).toBe(true)
  })

  it.each([undefined, '', 'false', 'TRUE', ' true ', 'enabled'])(
    'disables public sign-up for %j',
    (value) => {
      expect(parseEnabledFeatureFlag(value)).toBe(false)
    }
  )

  it('exposes typed flags with a secure default', () => {
    expect(getApplicationFeatureFlags({})).toEqual({
      libraryImportEnabled: false,
      publicSignUpEnabled: false
    })
  })

  it('enables the Library importer only through its explicit environment flag', () => {
    expect(getApplicationFeatureFlags({ LIBRARY_IMPORT_ENABLED: 'true' })).toEqual({
      libraryImportEnabled: true,
      publicSignUpEnabled: false
    })
  })
})
