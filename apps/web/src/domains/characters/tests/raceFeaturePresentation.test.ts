import { describe, expect, it } from 'vitest'
import { mergeRaceFeaturePresentation } from '../steps/raceFeaturePresentation'

describe('mergeRaceFeaturePresentation', () => {
  it('combines base and subrace ability score descriptions into one builder card', () => {
    const features = mergeRaceFeaturePresentation([
      {
        id: 'elf-asi',
        label: 'Ability Score Increase',
        description: 'Your Dexterity score increases by 2.',
        sourceLabel: 'Elf',
        source: { kind: 'RACE', raceId: 'race-elf' }
      },
      {
        id: 'high-elf-asi',
        label: 'Ability Score Increase',
        description: 'Your Intelligence score increases by 1.',
        sourceLabel: 'High Elf',
        source: { kind: 'SUBRACE', subraceId: 'race-high-elf' }
      }
    ])

    expect(features).toHaveLength(1)
    expect(features[0]).toMatchObject({
      id: 'elf-asi',
      description: 'Your Dexterity score increases by 2. Your Intelligence score increases by 1.'
    })
  })
})
