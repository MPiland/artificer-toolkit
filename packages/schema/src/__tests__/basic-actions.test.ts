import { describe, expect, it } from 'vitest'

import { basicActionReusableDefinitionDocumentDtoSchema } from '../shared/basicActions.js'
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
  mechanics: [],
  restrictions: null,
  effects: [],
  check: null
}
const dexterityId = '00000000-0000-4000-8000-00000000a002'

describe('basic-action catalogue contracts (Q11)', () => {
  it('parses a catalogue entry as its own reusable-definition family', () => {
    const parsed = reusableDefinitionDocumentDtoSchema.parse(dodge)
    expect(reusableDefinitionDocumentFamilyKey(parsed)).toBe('basic-action')
  })

  it('takes only closed, unique and sorted mechanic kinds', () => {
    const check = { checkDefinitionId: dexterityId, dc: 10 }
    const parse = (mechanics: string[], withCheck = false) =>
      basicActionReusableDefinitionDocumentDtoSchema.safeParse({
        ...dodge,
        mechanics,
        check: withCheck ? check : null
      }).success
    expect(parse([])).toBe(true)
    expect(parse(['STABILIZE_TARGET'], true)).toBe(true)
    expect(parse(['STABILIZE_TARGET', 'STABILIZE_TARGET'], true)).toBe(false)
    // Help is authored now: its retired mechanic code no longer parses.
    expect(parse(['ALLY_ADVANTAGE'])).toBe(false)
    expect(parse(['DASH'])).toBe(false)
    // Dash, Disengage and Dodge are authored now: their retired mechanic codes no longer parse.
    expect(parse(['SPEED_MOVEMENT_BONUS'])).toBe(false)
    expect(parse(['NO_OPPORTUNITY_ATTACKS'])).toBe(false)
    expect(parse(['SAVE_ADVANTAGE'])).toBe(false)
    expect(parse(['DISADVANTAGE_ON_ATTACKS_AGAINST'])).toBe(false)
    expect(
      basicActionReusableDefinitionDocumentDtoSchema.safeParse({ ...dodge, actionCost: 'REACTION' })
        .success
    ).toBe(false)
  })

  it('names a check exactly when the action stabilizes a creature', () => {
    const check = { checkDefinitionId: dexterityId, dc: 10 }
    const parse = (document: object) =>
      basicActionReusableDefinitionDocumentDtoSchema.safeParse({
        ...dodge,
        mechanics: [],
        ...document
      }).success
    expect(parse({ mechanics: ['STABILIZE_TARGET'], check })).toBe(true)
    expect(parse({ mechanics: ['STABILIZE_TARGET'], check: null })).toBe(false)
    expect(parse({ check })).toBe(false)
    expect(parse({ mechanics: ['STABILIZE_TARGET'], check: { ...check, dc: 0 } })).toBe(false)
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
        targetActorId: null
      }).acknowledgedWarnings
    ).toEqual([])
  })
})
