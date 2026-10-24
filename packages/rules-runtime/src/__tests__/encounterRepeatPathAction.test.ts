import { describe, expect, it } from 'vitest'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { flameBlade } from '@artificer-toolkit/source-data/srd/spells/flame-blade.js'
import { heatMetal } from '@artificer-toolkit/source-data/srd/spells/heat-metal.js'
import { huntersMark } from '@artificer-toolkit/source-data/srd/spells/hunters-mark.js'
import { spiritualWeapon } from '@artificer-toolkit/source-data/srd/spells/spiritual-weapon.js'
import { vampiricTouch } from '@artificer-toolkit/source-data/srd/spells/vampiric-touch.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { liveEffectOffers } from '../encounterEffectOffers.js'
import { featureActionMechanic } from '../encounterFeatureActionCapabilityDiscovery.js'
import {
  encounterActionOriginActorId,
  parseRepeatPathActionId,
  repeatOfferFreeUseKey,
  repeatOfferOriginActorId,
  repeatPathActionId
} from '../encounterRepeatPathAction.js'
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
const CAST_TURN = 4
/** A turn after the cast's, in which a repeat costs its authored activation. */
const LATER_TURN = {
  turn: { turnSequence: CAST_TURN + 2, currentActorId: SOURCE_ID },
  spentKeys: []
}

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
      repeat: { ...LATER_TURN, effectsByHolder: new Map([[HOLDER_ID, [heldCarrier()]]]) }
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
        repeat: { ...LATER_TURN, effectsByHolder: new Map([[HOLDER_ID, [heldCarrier(offer)]]]) }
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
          ...LATER_TURN,
          effectsByHolder: new Map([
            [
              HOLDER_ID,
              [
                heldCarrier({
                  ...compiledOffer(flameBlade),
                  ...(attackBonus === undefined ? {} : { attackBonus })
                })
              ]
            ]
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

  it('resolves its damage with the ability bonus its cast froze, whatever the caster has now (SPELLS-4.T2v2a3d)', () => {
    const input = { actor: caster, gameSystemId: DND5E_SYSTEM_ID, system, spells: new Map() }
    const offer = compiledOffer(spiritualWeapon)
    const [damage] = compileEffect(offer.effect).entries.flatMap((entry) =>
      'outcome' in entry && entry.outcome.effectKind === 'DAMAGE' ? [entry.outcome.id] : []
    )
    if (!damage) throw new Error('Spiritual Weapon must repeat a damage outcome.')
    const outcomes = (damageExpressions?: Record<string, string>) => {
      const source = resolveEncounterActionSource({
        ...input,
        actionId,
        repeat: {
          ...LATER_TURN,
          effectsByHolder: new Map([
            [
              HOLDER_ID,
              [
                heldCarrier({ ...offer, ...(damageExpressions && { damageExpressions }) })
              ]
            ]
          ])
        }
      })
      if (source.kind !== 'REPEAT_PATH') throw new Error('The id must resolve to a repeat.')
      return featureActionMechanic(source.capability).outcomes
    }

    // The Ogre making the repeat has no spellcasting modifier; the +3 is the one its cast had.
    expect(outcomes({ [damage]: '1d8 + 3' })).toEqual([
      expect.objectContaining({ kind: 'DAMAGE', outcomeId: damage, diceExpression: '1d8 + 3' })
    ])
    expect(outcomes()).toEqual([expect.not.objectContaining({ diceExpression: expect.anything() })])
  })

  describe('the creature its range is measured from (SPELLS-4.T2v2a3a)', () => {
    const SUMMON_ID = testUuid(0xf807)
    const summon = { id: SUMMON_ID, owner: { ownerActorId: SOURCE_ID, sourceEffectId: CARRIER_ID } }
    const origin = (offer: ReturnType<typeof compiledOffer>, actors: (typeof summon)[]) =>
      encounterActionOriginActorId({
        actorId: SOURCE_ID,
        actionId,
        actors: [{ id: SOURCE_ID }, ...actors],
        effectsByHolder: new Map([[HOLDER_ID, [heldCarrier(offer)]]])
      })
    const conjured = { ...compiledOffer(flameBlade), origin: 'CONJURED' as const }

    it('is the actor for any action but a CONJURED repeat, even beside a creature it owns', () => {
      expect(origin(compiledOffer(flameBlade), [summon])).toBe(SOURCE_ID)
      expect(origin({ ...compiledOffer(flameBlade), origin: 'ACTOR' }, [summon])).toBe(SOURCE_ID)
      expect(
        encounterActionOriginActorId({
          actorId: SOURCE_ID,
          actionId: `${SOURCE_ID}:basic:ATTACK`,
          actors: [summon],
          effectsByHolder: new Map()
        })
      ).toBe(SOURCE_ID)
    })

    it('is the creature a CONJURED repeat’s carrier conjured, and stale once it is gone', () => {
      expect(origin(conjured, [summon])).toBe(SUMMON_ID)
      // Another creature the actor owns, conjured by another effect, is never the origin.
      const other = { ...summon, owner: { ownerActorId: SOURCE_ID, sourceEffectId: ITEM_ID } }
      expect(() => origin(conjured, [other])).toThrow('stale')
      expect(() => origin(conjured, [])).toThrow('stale')
      expect(
        repeatOfferOriginActorId({
          actorId: HOLDER_ID,
          offer: { effectId: CARRIER_ID, origin: 'CONJURED' },
          actors: [summon]
        })
      ).toBeNull()
    })
  })

  describe('a free cast-turn use (SPELLS-4.T2v2a3b, D190a)', () => {
    const freeOnce = {
      ...compiledOffer(flameBlade),
      castTurnUse: 'FREE_ONCE' as const,
      castTurnSequence: CAST_TURN
    }
    const resolve = (
      turn: { turnSequence: number; currentActorId: string | null },
      spentKeys: readonly string[] = [],
      offer: ReturnType<typeof compiledOffer> = freeOnce
    ) => {
      const source = resolveEncounterActionSource({
        actor: caster,
        actionId,
        gameSystemId: DND5E_SYSTEM_ID,
        system,
        spells: new Map(),
        repeat: { effectsByHolder: new Map([[HOLDER_ID, [heldCarrier(offer)]]]), turn, spentKeys }
      })
      if (source.kind !== 'REPEAT_PATH') throw new Error('The id must resolve to a repeat.')
      return source
    }
    const castTurn = { turnSequence: CAST_TURN, currentActorId: SOURCE_ID }
    const authored = featureActionMechanic(resolve(LATER_TURN.turn).capability).activation
    const freeKey = repeatOfferFreeUseKey({
      offer: { effectId: CARRIER_ID, offerIndex: 0, castTurnSequence: CAST_TURN },
      turn: castTurn,
      spentKeys: []
    })

    it('costs nothing once in the cast’s turn, spending a once-per-turn key instead', () => {
      expect(authored).toEqual({ code: 'ACTION', amount: 1 })
      expect(freeKey).toEqual(expect.any(String))
      const free = resolve(castTurn)
      expect(free.grantedUseKey).toBe(freeKey)
      expect(featureActionMechanic(free.capability).activation).toEqual({
        code: 'FREE',
        amount: 1
      })
    })

    it('costs the authored activation once its key is spent in that turn', () => {
      const second = resolve(castTurn, [freeKey ?? ''])
      expect(second).not.toHaveProperty('grantedUseKey')
      expect(featureActionMechanic(second.capability).activation).toEqual(authored)
    })

    it('costs the authored activation in any other turn, and between turns', () => {
      for (const turn of [
        { turnSequence: CAST_TURN + 1, currentActorId: SOURCE_ID },
        { turnSequence: CAST_TURN - 1, currentActorId: SOURCE_ID },
        { turnSequence: CAST_TURN, currentActorId: null }
      ]) {
        const later = resolve(turn)
        expect(later).not.toHaveProperty('grantedUseKey')
        expect(featureActionMechanic(later.capability).activation).toEqual(authored)
      }
      // An offer that authors no free use is never free, even in the turn it was made.
      const plain = resolve(castTurn, [], compiledOffer(flameBlade))
      expect(plain).not.toHaveProperty('grantedUseKey')
      expect(featureActionMechanic(plain.capability).activation).toEqual(authored)
    })

    it('is stored only with the turn its cast froze', () => {
      const stored = (offer: ReturnType<typeof compiledOffer>) =>
        activeRuleEffectDefinitionDtoSchema.safeParse(heldCarrier(offer).definition).success
      const { castTurnSequence: _turn, ...unfrozen } = freeOnce
      const { castTurnUse: _use, ...stray } = freeOnce
      expect(stored(compiledOffer(flameBlade))).toBe(true)
      expect(stored(freeOnce)).toBe(true)
      expect(stored(unfrozen)).toBe(false)
      expect(stored(stray)).toBe(false)
    })

    it('is taken by the caster alone', () => {
      const effectsByHolder = new Map([[HOLDER_ID, [heldCarrier(freeOnce)]]])
      expect(
        liveEffectOffers({ actorId: HOLDER_ID, effectsByHolder, zeroHitPointActorIds: new Set() })
      ).toEqual([])
      const holder = srdCreatureActor({
        id: HOLDER_ID,
        creature: srdByLabel(SRD.creatures, 'Ogre')
      })
      expect(() =>
        resolveEncounterActionSource({
          actor: holder,
          actionId: repeatPathActionId(HOLDER_ID, CARRIER_ID, 0),
          gameSystemId: DND5E_SYSTEM_ID,
          system,
          spells: new Map(),
          repeat: {
            effectsByHolder,
            turn: { turnSequence: CAST_TURN, currentActorId: HOLDER_ID },
            spentKeys: []
          }
        })
      ).toThrow('stale')
    })
  })

  it('is stale once the carrier is gone or the id names another offer', () => {
    const input = { actor: caster, gameSystemId: DND5E_SYSTEM_ID, system, spells: new Map() }
    expect(() =>
      resolveEncounterActionSource({
        ...input,
        actionId,
        repeat: { ...LATER_TURN, effectsByHolder: new Map([[HOLDER_ID, []]]) }
      })
    ).toThrow('stale')
    expect(() =>
      resolveEncounterActionSource({
        ...input,
        actionId: repeatPathActionId(SOURCE_ID, CARRIER_ID, 1),
        repeat: { ...LATER_TURN, effectsByHolder: new Map([[HOLDER_ID, [heldCarrier()]]]) }
      })
    ).toThrow('stale')
  })
})
