import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { describe, expect, it } from 'vitest'

import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { appendAbilityIntentValidationIssues } from './builderEligibility.js'
import type { CharacterBuilderValidation } from './builderTypes.js'

const validationCodes = (assignments: { ability: string; option: '8' | '10' }[]) => {
  const character = createEmptyCharacterAuthored({
    id: 'character',
    systemId: DND5E_SYSTEM_ID,
    userId: 'user'
  })
  character.intent.abilities = { method: 'STANDARD_ARRAY', assignments }
  const validations: CharacterBuilderValidation[] = []
  appendAbilityIntentValidationIssues(character, validations)
  return validations.map(({ code, message }) => ({ code, message }))
}

describe('Builder ability assignments', () => {
  it('accepts assignments to the System abilities', () => {
    expect(
      validationCodes([
        { ability: 'STRENGTH', option: '8' },
        { ability: 'CHARISMA', option: '10' }
      ])
    ).toEqual([])
  })

  it('blocks an assignment to an ability the System does not list', () => {
    expect(validationCodes([{ ability: 'SANITY', option: '8' }])).toEqual([
      {
        code: 'UNKNOWN_ABILITY_ASSIGNMENT',
        message: 'The Game System does not define the ability "SANITY".'
      }
    ])
  })
})
