import { describe, expect, it } from 'vitest'

import {
  basicActionReusableDefinitionDocumentDtoSchema,
  encounterBasicActionEffectDtoSchema
} from '../shared/basicActions.js'
import {
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDocumentFamilyKey
} from '../shared/reusableDefinitions.js'
import { useEncounterBasicActionInputDtoSchema } from '../api/encounterRuleCommands.js'

const dodge = {
  schemaVersion: 1,
  kind: 'BASIC_ACTION',
  id: '00000000-0000-4000-8000-000000000b03',
  gameSystemId: '00000000-0000-0000-0000-000000000001',
  rulesText: 'Attacks against you have disadvantage until your next turn.',
  actionCost: 'ACTION',
  mechanics: ['DISADVANTAGE_ON_ATTACKS_AGAINST']
}

describe('basic-action catalogue contracts (Q11)', () => {
  it('parses a catalogue entry as its own reusable-definition family', () => {
    const parsed = reusableDefinitionDocumentDtoSchema.parse(dodge)
    expect(reusableDefinitionDocumentFamilyKey(parsed)).toBe('basic-action')
  })

  it('takes only closed, unique and sorted mechanic kinds', () => {
    const parse = (mechanics: string[]) =>
      basicActionReusableDefinitionDocumentDtoSchema.safeParse({ ...dodge, mechanics }).success
    expect(parse([])).toBe(true)
    expect(parse(['ALLY_ADVANTAGE', 'SPEED_MOVEMENT_BONUS'])).toBe(true)
    expect(parse(['SPEED_MOVEMENT_BONUS', 'ALLY_ADVANTAGE'])).toBe(false)
    expect(parse(['ALLY_ADVANTAGE', 'ALLY_ADVANTAGE'])).toBe(false)
    expect(parse(['DASH'])).toBe(false)
    expect(
      basicActionReusableDefinitionDocumentDtoSchema.safeParse({ ...dodge, actionCost: 'REACTION' })
        .success
    ).toBe(false)
  })

  it('names an ally only on an ally-advantage effect', () => {
    const effect = {
      definitionId: dodge.id,
      mechanic: 'ALLY_ADVANTAGE',
      round: 2,
      allyActorId: '33333333-3333-4333-8333-333333333332'
    }
    expect(encounterBasicActionEffectDtoSchema.safeParse(effect).success).toBe(true)
    expect(
      encounterBasicActionEffectDtoSchema.safeParse({ ...effect, allyActorId: null }).success
    ).toBe(false)
    expect(
      encounterBasicActionEffectDtoSchema.safeParse({
        ...effect,
        mechanic: 'DISADVANTAGE_ON_ATTACKS_AGAINST'
      }).success
    ).toBe(false)
  })

  it('defaults the acknowledged warnings of a basic-action command', () => {
    expect(
      useEncounterBasicActionInputDtoSchema.parse({
        type: 'USE_BASIC_ACTION',
        encounterId: '11111111-1111-4111-8111-111111111111',
        commandId: '22222222-2222-4222-8222-222222222222',
        expectedVersion: 3,
        actorId: '33333333-3333-4333-8333-333333333331',
        definitionId: dodge.id,
        allyActorId: null
      }).acknowledgedWarnings
    ).toEqual([])
  })
})
