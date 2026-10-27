import { describe, expect, it } from 'vitest'

import {
  actorRelationshipDtoSchema,
  actorRelationshipModuleDtoSchema
} from '../effects/actorRelationship.js'

const athletics = '00000000-0000-4000-8000-00000000c004'
const acrobatics = '00000000-0000-4000-8000-00000000c001'
const strength = '00000000-0000-4000-8000-00000000a001'

const escape = {
  id: '00000000-0000-4000-8000-0000000e5c01',
  order: 1,
  kind: 'ESCAPE_CHECK',
  activation: { code: 'ACTION', amount: 1 },
  checks: { skillIds: [acrobatics, athletics], abilityDefinitionIds: [] },
  dc: { kind: 'FIXED', value: 13 },
  actorKinds: ['TARGET']
}
const parse = (overrides: object) =>
  actorRelationshipModuleDtoSchema.safeParse({ ...escape, ...overrides }).success

describe('ESCAPE_CHECK relationship module (D105)', () => {
  it('names the allowed checks and a fixed DC', () => {
    expect(parse({})).toBe(true)
    expect(parse({ checks: { skillIds: [], abilityDefinitionIds: [strength] } })).toBe(true)
    expect(parse({ dc: { kind: 'FIXED', value: 0 } })).toBe(false)
  })

  it('contests the escape against the source creature’s authored checks', () => {
    expect(
      parse({
        dc: { kind: 'CONTEST', checks: { skillIds: [athletics], abilityDefinitionIds: [] } }
      })
    ).toBe(true)
    expect(
      parse({ dc: { kind: 'CONTEST', checks: { skillIds: [], abilityDefinitionIds: [] } } })
    ).toBe(false)
  })

  it('requires at least one unique, sorted check and drops the single-ability shape', () => {
    expect(parse({ checks: { skillIds: [], abilityDefinitionIds: [] } })).toBe(false)
    expect(parse({ checks: { skillIds: [athletics, acrobatics], abilityDefinitionIds: [] } })).toBe(
      false
    )
    expect(parse({ checks: { skillIds: [athletics, athletics], abilityDefinitionIds: [] } })).toBe(
      false
    )
    const { checks: _checks, dc: _dc, ...rest } = escape
    expect(
      actorRelationshipModuleDtoSchema.safeParse({
        ...rest,
        abilityDefinitionId: strength,
        fixedDc: 13
      }).success
    ).toBe(false)
  })

  it('moves a contested escape’s holder by an authored forced movement (MOVE-4.3)', () => {
    const contest = { kind: 'CONTEST', checks: { skillIds: [athletics], abilityDefinitionIds: [] } }
    const landing = {
      id: '00000000-0000-4000-8000-0000000e5c02',
      effectKind: 'FORCED_MOVEMENT',
      direction: 'ANY',
      actionEconomy: 'NONE',
      distanceMode: 'EXACT',
      amount: 5,
      unit: 'FEET'
    }
    expect(parse({ dc: contest, holderForcedMovement: landing })).toBe(true)
    expect(parse({ dc: contest, holderForcedMovement: { ...landing, direction: 'UP' } })).toBe(
      false
    )
    const relationship = (module: object) =>
      actorRelationshipDtoSchema.safeParse({
        id: '00000000-0000-4000-8000-0000000e5c03',
        effectKind: 'ACTOR_RELATIONSHIP',
        heldAtOnce: 1,
        modules: [{ ...escape, ...module }]
      }).success
    expect(relationship({ dc: contest, holderForcedMovement: landing })).toBe(true)
    // Only an escape the held creature contests against its holder moves that holder.
    expect(relationship({ holderForcedMovement: landing })).toBe(false)
    expect(
      relationship({
        dc: contest,
        actorKinds: ['CREATURE_WITHIN_REACH'],
        holderForcedMovement: landing
      })
    ).toBe(false)
  })
})
