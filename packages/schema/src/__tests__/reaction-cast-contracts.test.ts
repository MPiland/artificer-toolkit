import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { describe, expect, it } from 'vitest'

import { MAX_ENCOUNTER_REACTION_OPTIONS } from '../shared/authoredLimits.js'
import {
  encounterCastReactionOfferDtoSchema,
  encounterReactionPinDtoSchema,
  type EncounterReactionPinDto,
  encounterReactionSelectionIdentity,
  encounterReactionUseOptionId
} from '../shared/ruleExecutionReactionChoice.js'

/** REACTION-4.3: a cast offer is its own contract; an offer never mixes the triggers it holds. */

const uuid = (seed: number) => `00000000-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`

const castPin = (seed: number, trigger: EncounterReactionPinDto['trigger'] = 'SPELL_CAST') => {
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

describe('reaction pins', () => {
  it('seals every trigger the action pipeline offers with the one pin (QUALITY-7.1)', () => {
    for (const trigger of [
      'ATTACKED_SELF',
      'DAMAGE_TAKEN',
      'SPELL_CAST',
      'TARGETED_SELF',
      'ATTACK_ROLL_BY_OTHER',
      'ATTACK_ON_OTHER',
      'ATTACK_RESOLVED_ON_SELF'
    ] as const)
      expect(encounterReactionPinDtoSchema.safeParse(castPin(1, trigger)).success).toBe(true)
  })

  it('refuses a trigger the action pipeline does not offer', () => {
    for (const trigger of ['MOVEMENT', 'SOMETHING_ELSE'])
      expect(encounterReactionPinDtoSchema.safeParse({ ...castPin(1), trigger }).success).toBe(
        false
      )
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

  it('holds an ATTACK_ON_OTHER offer of ATTACK_ON_OTHER pins only, under its own kind (QUALITY-7.1)', () => {
    const offer = (...triggers: EncounterReactionPinDto['trigger'][]) => ({
      kind: 'ATTACK_ON_OTHER' as const,
      reactions: triggers.map((trigger, index) => castPin(index + 1, trigger)),
      declinedReactorActorIds: []
    })
    const parses = (value: unknown) => encounterCastReactionOfferDtoSchema.safeParse(value).success
    expect(parses(offer('ATTACK_ON_OTHER', 'ATTACK_ON_OTHER'))).toBe(true)
    expect(parses(offer('ATTACK_ON_OTHER', 'TARGETED_SELF'))).toBe(false)
    expect(parses({ ...offer('ATTACK_ON_OTHER'), kind: 'COUNTER' })).toBe(false)
    // The aimed offer does not travel under the targeted kind, nor the targeted offer under the aimed.
    expect(parses({ ...offer('ATTACK_ON_OTHER'), kind: 'TARGETED_SELF' })).toBe(false)
    expect(parses(offer('TARGETED_SELF'))).toBe(false)
  })

  it('holds an ATTACK_ROLL_BY_OTHER offer of its own pins only with the rolled d20 it follows (QUALITY-9.T1e1)', () => {
    // The offer that keeps a rolled d20 is proved against a stored pending action in encounter-persistence.
    const offer = (trigger: EncounterReactionPinDto['trigger']) => ({
      kind: 'ATTACK_ROLL_BY_OTHER' as const,
      reactions: [castPin(1, trigger)],
      declinedReactorActorIds: []
    })
    const issuePaths = (value: unknown) =>
      encounterCastReactionOfferDtoSchema.safeParse(value).error?.issues.map(({ path }) => path)
    expect(issuePaths(offer('ATTACK_ROLL_BY_OTHER'))).toEqual([['rolled']])
    expect(issuePaths(offer('ATTACK_ON_OTHER'))).toEqual([['reactions'], ['rolled']])
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
