import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { describe, expect, it } from 'vitest'

import { parsePublicationDocument } from '../authoredPublicationRead.js'
import { requireAuthoredAbilities } from '../systemAbilities.js'

describe('authored ability scores', () => {
  it('accepts a Creature scored on exactly its System abilities', () => {
    expect(() =>
      requireAuthoredAbilities(parsePublicationDocument('CREATURE', brownBear))
    ).not.toThrow()
  })

  it('refuses a Creature score under an ability the System does not list', () => {
    const creature = parsePublicationDocument('CREATURE', {
      ...brownBear,
      abilityScores: { ...brownBear.abilityScores, SANITY: 12 }
    })
    expect(() => requireAuthoredAbilities(creature)).toThrow(
      'The Game System does not define the ability "SANITY".'
    )
  })

  it('refuses a Creature missing a score for a System ability', () => {
    const { CHARISMA: _charisma, ...abilityScores } = brownBear.abilityScores
    const creature = parsePublicationDocument('CREATURE', { ...brownBear, abilityScores })
    expect(() => requireAuthoredAbilities(creature)).toThrow(
      'The Creature has no score for CHARISMA.'
    )
  })
})
