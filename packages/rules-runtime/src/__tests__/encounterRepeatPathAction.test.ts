import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { flameBlade } from '@artificer-toolkit/source-data/srd/spells/flame-blade.js'
import { heatMetal } from '@artificer-toolkit/source-data/srd/spells/heat-metal.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import { vampiricTouch } from '@artificer-toolkit/source-data/srd/spells/vampiric-touch.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { liveEffectOffers } from '../encounterEffectOffers.js'
import { featureActionMechanic } from '../encounterFeatureActionCapabilityDiscovery.js'
import { parseRepeatPathActionId, repeatPathActionId } from '../encounterRepeatPathAction.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { ENCOUNTER_ID, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

/**
 * SPELLS-4.T2lb2a (D166): the repeat a held effect offers its source is resolved from the offer the
 * cast froze, never from the caster's stats or slots as they stand when the repeat is made.
 */

const SOURCE_ID = testUuid(0xf801)
const HOLDER_ID = testUuid(0xf802)
const CARRIER_ID = testUuid(0xf803)
const ITEM_ID = testUuid(0xf804)
const FROZEN_DC = 23
const FROZEN_CAST_LEVEL = 5

const system = srdSystemRecord

/** The offer Heat Metal compiles to, with the DC and cast level its cast froze written in. */
function frozenOffer() {
  const [effect] = heatMetal.effects ?? []
  if (!effect) throw new Error('The SRD Heat Metal has no effect.')
  const offer = compileEffect(effect)
    .entries.flatMap((entry) => ('lifecycle' in entry ? (entry.lifecycle?.effectOffers ?? []) : []))
    .find((candidate) => candidate.kind === 'REPEAT_SOURCE_PATH')
  if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Heat Metal must offer a repeat.')
  const { invocation } = offer.effect
  if (!('savingThrow' in invocation)) throw new Error('Heat Metal must call for a save.')
  return {
    ...offer,
    castLevel: FROZEN_CAST_LEVEL,
    effect: {
      ...offer.effect,
      invocation: {
        ...invocation,
        savingThrow: {
          id: invocation.savingThrow.id,
          abilityDefinitionId: invocation.savingThrow.abilityDefinitionId,
          dcMethod: 'FIXED_DC' as const,
          baseDc: FROZEN_DC
        }
      }
    }
  }
}

/** The repeat offer the SRD spell's first Effect compiles to, siblings in hand. */
function compiledOffer(spell: { effects?: Parameters<typeof compileEffect>[0][] }) {
  const [effect] = spell.effects ?? []
  if (!effect) throw new Error('The SRD spell has no effect.')
  const offer = compileEffect(effect, spell.effects)
    .entries.flatMap((entry) => ('lifecycle' in entry ? (entry.lifecycle?.effectOffers ?? []) : []))
    .find((candidate) => candidate.kind === 'REPEAT_SOURCE_PATH')
  if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('The spell must offer a repeat.')
  return offer
}

/** The carrier a cast leaves on the target: a stored grant bound to the item, holding the offer. */
function heldCarrier(offer: ReturnType<typeof compiledOffer> = frozenOffer()) {
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: SOURCE_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect: huntersMark.effects?.[0],
    sourceLabel: 'Heat Metal'
  })
  const { definition } = planned
  return {
    id: CARRIER_ID,
    owner: {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: ENCOUNTER_ID,
      targetActorId: HOLDER_ID
    },
    definition: {
      ...definition,
      stateContributions: definition.stateContributions.map((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? {
              ...contribution,
              effectOffers: [offer],
              boundItem: {
                kind: 'EQUIPMENT_INSTANCE' as const,
                equipmentId: testUuid(0xf805),
                itemInstanceId: ITEM_ID
              }
            }
          : contribution
      )
    },
    lifecycle: planned.lifecycle,
    createdOrdinal: 1
  }
}

describe('the repeat a held effect offers its source (SPELLS-4.T2lb2a, D166)', () => {
  const caster = srdCreatureActor({ id: SOURCE_ID, creature: srdByLabel(SRD.creatures, 'Ogre') })
  const actionId = repeatPathActionId(SOURCE_ID, CARRIER_ID, 0)

  it('names the carrier and offer in its action id, and reads no other id as a repeat', () => {
    expect(parseRepeatPathActionId(SOURCE_ID, actionId)).toEqual({
      effectId: CARRIER_ID,
      offerIndex: 0
    })
    expect(parseRepeatPathActionId(HOLDER_ID, actionId)).toBeNull()
    expect(
      parseRepeatPathActionId(SOURCE_ID, `${SOURCE_ID}:REPEAT_PATH:${CARRIER_ID}:x`)
    ).toBeNull()
    expect(parseRepeatPathActionId(SOURCE_ID, `${SOURCE_ID}:basic:ATTACK`)).toBeNull()
  })

  it('is offered to the effect source alone, at the offer’s activation, whatever the holder’s hit points', () => {
    const effectsByHolder = new Map([[HOLDER_ID, [heldCarrier()]]])
    expect(
      liveEffectOffers({ actorId: SOURCE_ID, effectsByHolder, zeroHitPointActorIds: new Set() })
    ).toEqual([
      expect.objectContaining({
        kind: 'REPEAT_SOURCE_PATH',
        effectId: CARRIER_ID,
        offerIndex: 0,
        holderActorId: HOLDER_ID,
        activation: 'BONUS_ACTION'
      })
    ])
    for (const actorId of [HOLDER_ID, testUuid(0xf806)])
      expect(
        liveEffectOffers({ actorId, effectsByHolder, zeroHitPointActorIds: new Set() })
      ).toEqual([])
  })

  it('runs against the DC and cast level the cast froze, whatever the caster has now', () => {
    const source = resolveEncounterActionSource({
      actor: caster,
      actionId,
      gameSystemId: DND5E_SYSTEM_ID,
      system,
      spells: new Map(),
      repeat: { effectsByHolder: new Map([[HOLDER_ID, [heldCarrier()]]]) }
    })
    if (source.kind !== 'REPEAT_PATH') throw new Error('The id must resolve to a repeat.')
    expect(source.boundItemInstanceId).toBe(ITEM_ID)
    expect(source.capability).toMatchObject({
      holderActorId: HOLDER_ID,
      carrierEffectId: CARRIER_ID,
      label: 'Heat Metal',
      spellCastLevel: FROZEN_CAST_LEVEL
    })
    expect(featureActionMechanic(source.capability)).toMatchObject({
      spellCastLevel: FROZEN_CAST_LEVEL,
      activation: { code: 'BONUS_ACTION', amount: 1 },
      save: { dc: FROZEN_DC }
    })
  })

  it('runs against the holder unless the offer lets the invocation pick its targets', () => {
    const input = { actor: caster, gameSystemId: DND5E_SYSTEM_ID, system, spells: new Map() }
    const resolve = (offer: ReturnType<typeof compiledOffer>) => {
      const source = resolveEncounterActionSource({
        ...input,
        actionId,
        repeat: { effectsByHolder: new Map([[HOLDER_ID, [heldCarrier(offer)]]]) }
      })
      if (source.kind !== 'REPEAT_PATH') throw new Error('The id must resolve to a repeat.')
      return source.capability
    }

    // Vampiric Touch authors no target, so it keeps repeating against the holder.
    const vampiric = compiledOffer(vampiricTouch)
    expect(vampiric).not.toHaveProperty('target')
    expect(resolve(vampiric).target).toBe('HOLDER')

    // Flame Blade re-runs its sibling attack Effect against whoever the attack picks.
    const blade = compiledOffer(flameBlade)
    const attackEffect = flameBlade.effects?.[1]
    expect(blade).toMatchObject({ target: 'INVOCATION', effect: { id: attackEffect?.id } })
    expect(resolve(blade)).toMatchObject({ target: 'INVOCATION', effectId: attackEffect?.id })
  })

  it('reads the attack bonus its cast froze as the repeat capability mechanic', () => {
    const input = { actor: caster, gameSystemId: DND5E_SYSTEM_ID, system, spells: new Map() }
    const resolve = (attackBonus?: number) => {
      const source = resolveEncounterActionSource({
        ...input,
        actionId,
        repeat: {
          effectsByHolder: new Map([
            [HOLDER_ID, [heldCarrier({ ...compiledOffer(flameBlade), attackBonus })]]
          ])
        }
      })
      if (source.kind !== 'REPEAT_PATH') throw new Error('The id must resolve to a repeat.')
      return source.capability
    }

    expect(resolve(7).attackMechanic).toEqual({ attackBonus: 7, rollMode: 'NORMAL' })
    expect(featureActionMechanic(resolve(7))).toMatchObject({ attackBonus: 7 })
    expect(resolve().attackMechanic).toBeNull()
  })

  it('is stale once the carrier is gone or the id names another offer', () => {
    const input = { actor: caster, gameSystemId: DND5E_SYSTEM_ID, system, spells: new Map() }
    expect(() =>
      resolveEncounterActionSource({
        ...input,
        actionId,
        repeat: { effectsByHolder: new Map([[HOLDER_ID, []]]) }
      })
    ).toThrow('stale')
    expect(() =>
      resolveEncounterActionSource({
        ...input,
        actionId: repeatPathActionId(SOURCE_ID, CARRIER_ID, 1),
        repeat: { effectsByHolder: new Map([[HOLDER_ID, [heldCarrier()]]]) }
      })
    ).toThrow('stale')
  })
})
