import { describe, expect, it } from 'vitest'

import { basicActionReusableDefinitionDocumentDtoSchema } from '../shared/basicActions.js'
import {
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDocumentFamilyKey
} from '../shared/reusableDefinitions.js'

const dodge = {
  schemaVersion: 1,
  kind: 'BASIC_ACTION',
  id: '00000000-0000-4000-8000-000000000b03',
  gameSystemId: '00000000-0000-0000-0000-000000000001',
  rulesText: 'Attacks against you have disadvantage until your next turn.',
  actionCost: 'ACTION',
  restrictions: null,
  effects: []
}

describe('basic-action catalogue contracts (Q11)', () => {
  it('parses a catalogue entry as its own reusable-definition family', () => {
    const parsed = reusableDefinitionDocumentDtoSchema.parse(dodge)
    expect(reusableDefinitionDocumentFamilyKey(parsed)).toBe('basic-action')
  })

  it('keeps only authored effects: the retired mechanic list and check fields no longer parse', () => {
    const parse = (document: object) =>
      basicActionReusableDefinitionDocumentDtoSchema.safeParse({ ...dodge, ...document }).success
    expect(parse({})).toBe(true)
    expect(parse({ mechanics: [] })).toBe(false)
    expect(parse({ check: null })).toBe(false)
    expect(parse({ actionCost: 'REACTION' })).toBe(false)
  })

  it('accepts a cost of one attack of the Attack action (D152)', () => {
    expect(
      basicActionReusableDefinitionDocumentDtoSchema.safeParse({ ...dodge, actionCost: 'ATTACK' })
        .success
    ).toBe(true)
  })
})
