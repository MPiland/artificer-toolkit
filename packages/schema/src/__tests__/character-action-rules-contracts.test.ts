import { describe, expect, it } from 'vitest'

import {
  characterActionCandidatesSchema,
  characterActionDecisionsSchema
} from '../api/characterActionRules.js'

const source = { kind: 'SYSTEM' as const, systemId: 'dnd5e2014' }
const mechanicFacts = {
  invocation: {
    triggerCode: 'ACTIVATED',
    activation: { code: 'ACTION', amount: 1 },
    range: { rangeKind: 'SELF', amount: null, unit: null },
    savingThrow: null
  },
  outcomes: []
}
const mechanic = {
  effectId: 'effect',
  trigger: 'ACTIVATED',
  activation: { kind: 'ACTION', amount: 1 },
  rangeLabel: 'Self',
  attackBonus: null,
  attackRollMode: null,
  save: null,
  outcomes: []
}

describe('Character action rule contracts', () => {
  it('accepts exact action candidates and rejects non-contiguous or incomplete equipment candidates', () => {
    const candidate = {
      sequence: 0,
      actionId: 'source:ACTION:effect',
      effectId: 'effect',
      sourceId: 'source',
      source,
      mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
      activationSourceKind: 'ACTIVE_SOURCE' as const,
      equipment: null,
      resourceUse: { chargeId: 'charge', cost: 1, poolId: 'pool' },
      mechanicFacts
    }
    expect(characterActionCandidatesSchema.safeParse([candidate]).success).toBe(true)
    expect(characterActionCandidatesSchema.safeParse([{ ...candidate, sequence: 1 }]).success).toBe(
      false
    )
    expect(
      characterActionCandidatesSchema.safeParse([
        { ...candidate, activationSourceKind: 'ACTIVE_EQUIPMENT', equipment: null }
      ]).success
    ).toBe(false)
  })

  it('enforces status, reason, and resource binding consistency', () => {
    const decision = {
      sequence: 0,
      actionId: 'source:ACTION:effect',
      effectId: 'effect',
      sourceId: 'source',
      source,
      mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
      status: 'AVAILABLE' as const,
      reasonCode: null,
      resourcePoolId: 'pool',
      resourceCost: 1,
      mechanic
    }
    expect(characterActionDecisionsSchema.safeParse([decision]).success).toBe(true)
    expect(
      characterActionDecisionsSchema.safeParse([
        { ...decision, status: 'UNAVAILABLE', reasonCode: 'RESOURCE_MISSING' }
      ]).success
    ).toBe(false)
    expect(
      characterActionDecisionsSchema.safeParse([
        { ...decision, status: 'AVAILABLE', reasonCode: 'INSUFFICIENT_RESOURCE' }
      ]).success
    ).toBe(false)
  })
})
