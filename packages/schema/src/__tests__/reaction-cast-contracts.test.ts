import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { describe, expect, it } from 'vitest'

import {
  encounterCastReactionOfferDtoSchema,
  encounterCastReactionPinDtoSchema,
  encounterReactionPinDtoSchema,
  encounterReactionSelectionIdentity,
  encounterReactionUseOptionId
} from '../shared/ruleExecutionReactionChoice.js'

/** REACTION-4.3: a cast offer is its own contract; attack and cast reactions never share a trigger. */

const uuid = (seed: number) => `00000000-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`

const castPin = (seed: number) => {
  const identity = {
    trigger: 'SPELL_CAST' as const,
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
})

describe('cast reaction offers', () => {
  it('holds one to eight reactions and the reactors that declined', () => {
    const offer = (count: number) => ({
      reactions: Array.from({ length: count }, (_, index) => castPin(index + 1)),
      declinedReactorActorIds: [uuid(900)]
    })
    expect(encounterCastReactionOfferDtoSchema.safeParse(offer(1)).success).toBe(true)
    expect(encounterCastReactionOfferDtoSchema.safeParse(offer(8)).success).toBe(true)
    expect(encounterCastReactionOfferDtoSchema.safeParse(offer(0)).success).toBe(false)
    expect(encounterCastReactionOfferDtoSchema.safeParse(offer(9)).success).toBe(false)
  })

  it('refuses a missing decline record', () => {
    expect(encounterCastReactionOfferDtoSchema.safeParse({ reactions: [castPin(1)] }).success).toBe(
      false
    )
  })
})
