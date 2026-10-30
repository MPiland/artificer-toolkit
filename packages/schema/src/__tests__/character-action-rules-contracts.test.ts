import { describe, expect, it } from 'vitest'

import {
  characterActionCandidatesSchema,
  characterActionDecisionsSchema
} from '../api/characterActionRules.js'

const source = { kind: 'SYSTEM' as const, systemId: 'dnd5e2014' }
const EFFECT_ID = '00000000-0000-4000-8000-0000000000c1'
const mechanicFacts = {
  invocation: {
    triggerCode: 'ACTIVATED',
    activation: { code: 'ACTION', amount: 1 },
    range: { rangeKind: 'SELF', amount: null, longAmount: null, unit: null },
    savingThrow: null,
    reactionTrigger: null
  },
  outcomes: []
}
const mechanic = {
  effectId: EFFECT_ID,
  trigger: 'ACTIVATED',
  activation: { kind: 'ACTION', amount: 1 },
  rangeLabel: 'Self',
  attackKind: null,
  attackDomain: null,
  attackAbility: null,
  attackBonus: null,
  attackRollMode: null,
  save: null,
  outcomes: []
}

describe('Character action rule contracts', () => {
  it('accepts exact action candidates and rejects non-contiguous or incomplete equipment candidates', () => {
    const candidate = {
      sequence: 0,
      label: 'Strike',
      actionId: 'source:ACTION:effect',
      effectId: EFFECT_ID,
      sourceId: 'source',
      source,
      mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
      activationSourceKind: 'ACTIVE_SOURCE' as const,
      equipment: null,
      resourceUse: { chargeId: 'charge', cost: 1, poolId: 'pool' },
      mechanicFacts
    }
    expect(characterActionCandidatesSchema.safeParse([candidate]).success).toBe(true)
    const { label: _label, ...unlabelled } = candidate
    expect(characterActionCandidatesSchema.safeParse([unlabelled]).success).toBe(false)
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
      effectId: EFFECT_ID,
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
    expect(
      characterActionDecisionsSchema.safeParse([
        { ...decision, mechanic: { ...mechanic, effectId: 'non-uuid-effect' } }
      ]).success
    ).toBe(false)
  })

  it('requires canonical condition definition UUIDs in action facts', () => {
    const candidate = {
      sequence: 0,
      label: 'Strike',
      actionId: 'source:ACTION:effect',
      effectId: EFFECT_ID,
      sourceId: 'source',
      source,
      mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
      activationSourceKind: 'ACTIVE_SOURCE' as const,
      equipment: null,
      resourceUse: null,
      mechanicFacts: {
        ...mechanicFacts,
        outcomes: [{ kind: 'CONDITION', pathCode: 'ON_USE', conditionId: 'not-a-uuid' }]
      }
    }
    expect(characterActionCandidatesSchema.safeParse([candidate]).success).toBe(false)
    expect(
      characterActionCandidatesSchema.safeParse([
        {
          ...candidate,
          mechanicFacts: {
            ...candidate.mechanicFacts,
            outcomes: [
              {
                kind: 'CONDITION',
                pathCode: 'ON_USE',
                conditionId: 'aaaaaaaa-0000-4000-8000-000000000001'.toUpperCase()
              }
            ]
          }
        }
      ]).success
    ).toBe(false)
  })

  it('round-trips a reaction movement trigger binding through an action candidate', () => {
    const candidate = {
      sequence: 0,
      label: 'Strike',
      actionId: 'source:ACTION:effect',
      effectId: EFFECT_ID,
      sourceId: 'source',
      source,
      mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
      activationSourceKind: 'ACTIVE_SOURCE' as const,
      equipment: null,
      resourceUse: null,
      mechanicFacts: {
        ...mechanicFacts,
        invocation: {
          ...mechanicFacts.invocation,
          activation: { code: 'REACTION', amount: 1 },
          reactionTrigger: {
            kind: 'MOVEMENT' as const,
            stage: 'BEFORE_LEAVE_REACH' as const,
            perceptionRequirement: 'SEE' as const,
            eligibilityDefinitionId: 'AAAAAAAA-0000-4000-8000-000000000001'
          }
        }
      }
    }

    const parsed = characterActionCandidatesSchema.parse([candidate])
    expect(parsed[0]?.mechanicFacts.invocation.reactionTrigger).toEqual({
      kind: 'MOVEMENT',
      stage: 'BEFORE_LEAVE_REACH',
      perceptionRequirement: 'SEE',
      movementInterruption: null,
      eligibilityDefinitionId: 'aaaaaaaa-0000-4000-8000-000000000001'
    })
  })

  it('round-trips an attacked-self reaction trigger through an action candidate', () => {
    const candidate = {
      sequence: 0,
      label: 'Strike',
      actionId: 'source:ACTION:effect',
      effectId: EFFECT_ID,
      sourceId: 'source',
      source,
      mechanicsOwner: { kind: 'FEATURE', id: 'feature' },
      activationSourceKind: 'ACTIVE_SOURCE' as const,
      equipment: null,
      resourceUse: null,
      mechanicFacts: {
        ...mechanicFacts,
        invocation: {
          ...mechanicFacts.invocation,
          activation: { code: 'REACTION', amount: 1 },
          reactionTrigger: { kind: 'ATTACKED_SELF' as const }
        }
      }
    }

    expect(
      characterActionCandidatesSchema.parse([candidate])[0]?.mechanicFacts.invocation
        .reactionTrigger
    ).toEqual({ kind: 'ATTACKED_SELF' })
    expect(
      characterActionCandidatesSchema.safeParse([
        {
          ...candidate,
          mechanicFacts: {
            ...candidate.mechanicFacts,
            invocation: {
              ...candidate.mechanicFacts.invocation,
              reactionTrigger: { kind: 'ATTACKED_SELF', stage: 'ENTER_REACH' }
            }
          }
        }
      ]).success
    ).toBe(false)
  })
})
