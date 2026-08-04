import { describe, expect, it } from 'vitest'
import { readAuthoringExperience } from './authoringExperience'

describe('authoring experience preference', () => {
  it('defaults to guided and accepts only the explicit advanced preference', () => {
    expect(readAuthoringExperience(null)).toBe('guided')
    expect(readAuthoringExperience(createUser('guided'))).toBe('guided')
    expect(readAuthoringExperience(createUser('advanced'))).toBe('advanced')
    expect(readAuthoringExperience(createUser('unexpected'))).toBe('guided')
  })
})

function createUser(authoringExperience: string) {
  return {
    user_metadata: { authoring_experience: authoringExperience }
  }
}
