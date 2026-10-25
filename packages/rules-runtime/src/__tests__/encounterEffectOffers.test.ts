import { describe, expect, it } from 'vitest'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'

import { onEndGrantEffect } from '../encounterEffectOnEnd.js'
import {
  effectOfferTargetPolicy,
  effectOffersFor,
  liveEffectOffers,
  resolveEffectOffer
} from '../encounterEffectOffers.js'
import { evaluateEncounterActionTargetPolicy } from '../encounterActionTargetPolicy.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

/** SPELLS-4.T2d2: the offers a held effect makes its source (D160), read from the held effect. */

const SOURCE_ID = testUuid(0xf701)
const HOLDER_ID = testUuid(0xf702)
const OTHER_ID = testUuid(0xf703)
const EFFECT_ID = testUuid(0xf704)

function heldRecord(effect: Parameters<typeof plannedModifierGrant>[0]['effect']) {
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: SOURCE_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect,
    rounds: 10
  })
  return {
    id: EFFECT_ID,
    owner: {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ENCOUNTER_ID,
      targetActorId: HOLDER_ID
    },
    definition: planned.definition,
    lifecycle: planned.lifecycle,
    createdOrdinal: 1
  }
}

const marked = () => heldRecord(huntersMark.effects?.[0])
const byHolder = (record = marked()) => new Map([[HOLDER_ID, [record]]])
const atZero = new Set([HOLDER_ID])

describe('the effect offers a held effect makes', () => {
  it('lists the offer the authored spell makes its source, bonus action within 90 feet', () => {
    expect(
      liveEffectOffers({
        actorId: SOURCE_ID,
        effectsByHolder: byHolder(),
        zeroHitPointActorIds: atZero
      })
    ).toEqual([
      {
        kind: 'MOVE_HELD_EFFECT',
        effectId: EFFECT_ID,
        offerIndex: 0,
        holderActorId: HOLDER_ID,
        activation: 'BONUS_ACTION',
        range: { amount: 90, unit: 'FEET' }
      }
    ])
  })

  it('offers it only while its condition holds on the holder', () => {
    const input = { actorId: SOURCE_ID, effectsByHolder: byHolder() }
    expect(liveEffectOffers({ ...input, zeroHitPointActorIds: new Set() })).toEqual([])
    expect(liveEffectOffers({ ...input, zeroHitPointActorIds: new Set([OTHER_ID]) })).toEqual([])
    expect(effectOffersFor(input)).toHaveLength(1)
  })

  it('offers it to its source alone, not to the holder or another actor', () => {
    for (const actorId of [HOLDER_ID, OTHER_ID])
      expect(
        liveEffectOffers({
          actorId,
          effectsByHolder: byHolder(),
          zeroHitPointActorIds: atZero
        })
      ).toEqual([])
  })

  it('offers nothing once the effect is gone', () => {
    expect(
      liveEffectOffers({
        actorId: SOURCE_ID,
        effectsByHolder: new Map([[HOLDER_ID, []]]),
        zeroHitPointActorIds: atZero
      })
    ).toEqual([])
  })

  it('resolves a pick against the live offer and refuses a stale one', () => {
    const live = {
      actorId: SOURCE_ID,
      effectsByHolder: byHolder(),
      zeroHitPointActorIds: atZero,
      effectId: EFFECT_ID,
      offerIndex: 0,
      kind: 'MOVE_HELD_EFFECT' as const
    }
    expect(resolveEffectOffer(live)).toMatchObject({
      effectId: EFFECT_ID,
      holderActorId: HOLDER_ID
    })
    expect(() => resolveEffectOffer({ ...live, offerIndex: 1 })).toThrow('stale')
    expect(() => resolveEffectOffer({ ...live, zeroHitPointActorIds: new Set() })).toThrow('stale')
    expect(() => resolveEffectOffer({ ...live, effectId: testUuid(0xf7ff) })).toThrow('stale')
  })

  it('does not hand the offer to the follow-on grant a held effect leaves behind', () => {
    const offer = {
      kind: 'MOVE_HELD_EFFECT' as const,
      offeredTo: 'SOURCE' as const,
      when: 'HOLDER_AT_ZERO_HP' as const,
      activation: 'BONUS_ACTION' as const,
      range: { amount: 30, unit: 'FEET' as const }
    }
    const planned = plannedModifierGrant({
      encounterId: ENCOUNTER_ID,
      sourceActorId: SOURCE_ID,
      holderActorId: HOLDER_ID,
      lifecycle: { effectOffers: [offer] },
      effect: haste.effects?.[0],
      rounds: 10
    })
    const held = {
      id: EFFECT_ID,
      owner: {
        kind: 'ENCOUNTER_ACTOR' as const,
        encounterId: ENCOUNTER_ID,
        targetActorId: HOLDER_ID
      },
      definition: planned.definition,
      lifecycle: planned.lifecycle,
      createdOrdinal: 1
    }
    expect(effectOffersFor({ actorId: SOURCE_ID, effectsByHolder: byHolder(held) })).toHaveLength(1)
    const follow = onEndGrantEffect(held)
    expect(follow).not.toBeNull()
    expect(
      effectOffersFor({
        actorId: SOURCE_ID,
        effectsByHolder: new Map([
          [HOLDER_ID, [{ id: follow!.id, definition: follow!.definition }]]
        ])
      })
    ).toEqual([])
  })
})

describe('the range an offer holds the new holder to', () => {
  const actor = { id: SOURCE_ID, disposition: 'FRIENDLY' as const }
  const target = { id: HOLDER_ID, disposition: 'FRIENDLY' as const }

  it('is any single creature within the offer’s distance, measured only with a Scene', () => {
    const policy = effectOfferTargetPolicy({ amount: 90, unit: 'FEET' })
    expect(policy.range).toMatchObject({ rangeKind: 'DISTANCE', amount: 90, unit: 'FEET' })
    expect(
      evaluateEncounterActionTargetPolicy({
        actor,
        target,
        targetPolicy: policy,
        sceneContext: null,
        makesAttackRoll: false,
        facing: null
      })
    ).toEqual([expect.objectContaining({ code: 'TARGET_RANGE_UNCHECKED' })])
  })
})
