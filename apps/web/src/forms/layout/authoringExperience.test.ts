import { describe, expect, it } from 'vitest'
import { readAuthoringExperience } from './authoringExperience'

describe('authoring experience preference', () => {
  it('defaults to guided and returns the session preference', () => {
    expect(readAuthoringExperience(null)).toBe('guided')
    expect(readAuthoringExperience({ authoringExperience: 'guided' })).toBe('guided')
    expect(readAuthoringExperience({ authoringExperience: 'advanced' })).toBe('advanced')
  })
})
