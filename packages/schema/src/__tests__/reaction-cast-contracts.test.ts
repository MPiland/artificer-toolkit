import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { describe, expect, it } from 'vitest'

import { MAX_ENCOUNTER_REACTION_OPTIONS } from '../shared/authoredLimits.js'
import {
  encounterCastReactionOfferDtoSchema,
  encounterCastReactionPinDtoSchema,
  encounterReactionPinDtoSchema,
  encounterReactionSelectionIdentity,
  encounterReactionUseOptionId
} from '../shared/ruleExecutionReactionChoice.js'

/** REACTION-4.3: a cast offer is its own contract; attack and cast reactions never share a trigger. */

const uuid = (seed: number) => `00000000-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`

const castPin = (seed: number, trigger: 'SPELL_CAST' | 'TARGETED_SELF' = 'SPELL_CAST') => {
  const identity = {
    trigger,
    reactorActorId: uuid(seed),
    characterId: uuid(seed + 100),
    actionId: `counterspell-${seed}`,
    effectId: uuid(seed + 200),
    allowanceDefinitionId: uuid(seed + 300),
    choiceDefinitionId: uuid(seed + 400),
    choiceDefinitionChecksum: checksumRuleDocument('choice')
  }
  const selectionChecksum = checksumRuleDocument(encounterReactionSelectionIdentity(identity))
  return {
    ...identity,
    characterStreamVersion: 3,
    allowanceBeforeUsed: 0,
    allowanceMaximum: 1,
    selectionChecksum,
    useOptionId: encounterReactionUseOptionId(selectionChecksum)
  }
}

describe('cast reaction pins', () => {
  it('accepts a SPELL_CAST pin as a cast reaction only', () => {
    const pin = castPin(1)
    expect(encounterCastReactionPinDtoSchema.safeParse(pin).success).toBe(true)
    expect(encounterReactionPinDtoSchema.safeParse(pin).success).toBe(false)
  })

  it('refuses an attack trigger on a cast reaction', () => {
    expect(
      encounterCastReactionPinDtoSchema.safeParse({ ...castPin(1), trigger: 'ATTACKED_SELF' })
        .success
    ).toBe(false)
  })

  it('accepts a TARGETED_SELF pin as a cast reaction only (REACTION-4.1)', () => {
    const pin = castPin(1, 'TARGETED_SELF')
    expect(encounterCastReactionPinDtoSchema.safeParse(pin).success).toBe(true)
    expect(encounterReactionPinDtoSchema.safeParse(pin).success).toBe(false)
  })
})

describe('cast reaction offers', () => {
  it('holds up to the limit of reactions and the reactors that declined', () => {
    const offer = (count: number) => ({
      kind: 'COUNTER' as const,
      reactions: Array.from({ length: count }, (_, index) => castPin(index + 1)),
      declinedReactorActorIds: [uuid(900)]
    })
    expect(encounterCastReactionOfferDtoSchema.safeParse(offer(1)).success).toBe(true)
    expect(
      encounterCastReactionOfferDtoSchema.safeParse(offer(MAX_ENCOUNTER_REACTION_OPTIONS)).success
    ).toBe(true)
    expect(encounterCastReactionOfferDtoSchema.safeParse(offer(0)).success).toBe(false)
    expect(
      encounterCastReactionOfferDtoSchema.safeParse(offer(MAX_ENCOUNTER_REACTION_OPTIONS + 1))
        .success
    ).toBe(false)
  })

  it('refuses a missing decline record', () => {
    expect(
      encounterCastReactionOfferDtoSchema.safeParse({ kind: 'COUNTER', reactions: [castPin(1)] })
        .success
    ).toBe(false)
  })

  it('names what it offers: the kind is required and has no default (REACTION-4.1)', () => {
    const offer = { reactions: [castPin(1)], declinedReactorActorIds: [] }
    expect(encounterCastReactionOfferDtoSchema.safeParse(offer).success).toBe(false)
    expect(
      encounterCastReactionOfferDtoSchema.safeParse({ ...offer, kind: 'COUNTER' }).success
    ).toBe(true)
    expect(
      encounterCastReactionOfferDtoSchema.safeParse({ ...offer, kind: 'SOMETHING_ELSE' }).success
    ).toBe(false)
  })

  it('holds a TARGETED_SELF offer of TARGETED_SELF pins only (REACTION-4.1)', () => {
    const offer = {
      kind: 'TARGETED_SELF' as const,
      reactions: [castPin(1, 'TARGETED_SELF')],
      declinedReactorActorIds: [uuid(900)]
    }
    const parses = (value: unknown) => encounterCastReactionOfferDtoSchema.safeParse(value).success
    expect(parses(offer)).toBe(true)
    // A counter offer holds counters, and a targeted offer holds targeted reactions: never mixed.
    expect(parses({ ...offer, kind: 'COUNTER' })).toBe(false)
    expect(parses({ ...offer, reactions: [castPin(1)] })).toBe(false)
    expect(parses({ ...offer, kind: 'COUNTER', reactions: [castPin(1)] })).toBe(true)
  })

  it('holds a chain only with a counter standing, and the declines it outranks', () => {
    const withChain = (chain: unknown) =>
      encounterCastReactionOfferDtoSchema.safeParse({
        kind: 'COUNTER',
        reactions: [castPin(1)],
        declinedReactorActorIds: [],
        chain
      }).success
    expect(withChain({ counters: [], castDeclinedReactorActorIds: [], castLevel: 3 })).toBe(false)
    expect(withChain({ counters: [{}], castDeclinedReactorActorIds: [], castLevel: 3 })).toBe(false)
    expect(withChain({ castDeclinedReactorActorIds: [], castLevel: 3 })).toBe(false)
  })
})
