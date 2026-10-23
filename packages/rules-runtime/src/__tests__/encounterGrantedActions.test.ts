import { describe, expect, it } from 'vitest'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { expeditiousRetreat } from '@artificer-toolkit/source-data/srd/spells/expeditious-retreat.js'
import { haste } from '@artificer-toolkit/source-data/srd/spells/haste.js'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { resolveEncounterActionSource } from '../encounterActionSources.js'
import {
  discoverEncounterBasicActions,
  readEncounterBasicActionEntries
} from '../encounterBasicActionCapabilityDiscovery.js'
import { onEndGrantEffect } from '../encounterEffectOnEnd.js'
import {
  grantedActionId,
  heldGrantedActions,
  nextGrantedActionUseKey,
  parseGrantedActionId,
  resolveGrantedAction,
  standingGrantedActions
} from '../encounterGrantedActions.js'
import { snapshotFeatureDefinitions } from '../encounterActorState.js'
import {
  creatureFeature,
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  srdCreatureActor,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

/** SPELLS-4.T2lb: the actions a held effect offers its holder (D160), read from the held effect. */

const CASTER_ID = testUuid(0xf601)
const HOLDER_ID = testUuid(0xf602)
const HASTE_EFFECT_ID = testUuid(0xf603)
const RETREAT_EFFECT_ID = testUuid(0xf604)
const wolf = srdByLabel(SRD.creatures, 'Wolf')

function heldRecord(
  effectId: string,
  spell: { effects?: Parameters<typeof plannedModifierGrant>[0]['effect'][] }
) {
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect: spell.effects?.[0],
    rounds: 10
  })
  return {
    id: effectId,
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

const hasteHeld = () => heldRecord(HASTE_EFFECT_ID, haste)
const retreatHeld = () => heldRecord(RETREAT_EFFECT_ID, expeditiousRetreat)

describe('the offers a held effect makes', () => {
  it('reads Haste’s extra action: one use a turn, a weapon attack or four basic actions', () => {
    expect(heldGrantedActions([hasteHeld()])).toEqual([
      {
        effectId: HASTE_EFFECT_ID,
        offerIndex: 0,
        offer: {
          activation: 'FREE',
          usesPerTurn: 1,
          weaponAttack: true,
          actionDefinitionIds: [
            SRD_BASIC_ACTION_IDS.DASH,
            SRD_BASIC_ACTION_IDS.DISENGAGE,
            SRD_BASIC_ACTION_IDS.HIDE,
            SRD_BASIC_ACTION_IDS.USE_AN_OBJECT
          ]
        }
      }
    ])
  })

  it('reads Expeditious Retreat’s Dash as a Bonus Action with no cap', () => {
    const [held] = heldGrantedActions([retreatHeld()])
    expect(held?.offer).toEqual({
      activation: 'BONUS_ACTION',
      actionDefinitionIds: [SRD_BASIC_ACTION_IDS.DASH]
    })
    expect(nextGrantedActionUseKey(held!, [])).toBeNull()
  })

  it('offers nothing once the effect is gone, and the lethargy Haste leaves offers nothing', () => {
    expect(heldGrantedActions([])).toEqual([])
    const follow = onEndGrantEffect(hasteHeld())
    expect(heldGrantedActions([{ id: follow!.id, definition: follow!.definition }])).toEqual([])
  })

  it('counts a capped offer’s uses in the turn’s once-per-turn keys', () => {
    const [held] = heldGrantedActions([hasteHeld()])
    const key = nextGrantedActionUseKey(held!, [])
    expect(typeof key).toBe('string')
    expect(nextGrantedActionUseKey(held!, [key as string])).toBeUndefined()
  })
})

describe('the offers a Creature’s traits make on every turn', () => {
  const goblin = srdByLabel(SRD.creatures, 'Goblin')
  const clayGolem = srdByLabel(SRD.creatures, 'Clay Golem')
  const standingOf = (creature: typeof goblin) =>
    standingGrantedActions(
      snapshotFeatureDefinitions(srdCreatureActor({ id: HOLDER_ID, creature }))
    )
  const nimbleEscapeId = creatureFeature(goblin, 'Nimble Escape').effects![0]!.id

  it('reads the Goblin’s Nimble Escape: Disengage or Hide as a Bonus Action', () => {
    expect(standingOf(goblin)).toEqual([
      {
        effectId: nimbleEscapeId,
        offerIndex: 0,
        offer: {
          activation: 'BONUS_ACTION',
          actionDefinitionIds: [SRD_BASIC_ACTION_IDS.DISENGAGE, SRD_BASIC_ACTION_IDS.HIDE]
        }
      }
    ])
  })

  it('offers nothing for an activated trait, whose grant is timed', () => {
    expect(standingOf(clayGolem)).toEqual([])
  })

  it('resolves a standing offer and refuses an action it does not name', () => {
    const base = (definitionId: string) => `${HOLDER_ID}:BASIC_ACTION:${definitionId}:EFFECT:x`
    const standing = standingOf(goblin)
    const resolved = resolveGrantedAction({
      actionId: grantedActionId(base(SRD_BASIC_ACTION_IDS.HIDE), nimbleEscapeId, 0),
      heldEffects: [],
      standing,
      spentKeys: []
    })
    expect(resolved).toMatchObject({ offer: { activation: 'BONUS_ACTION' }, useKey: null })
    expect(() =>
      resolveGrantedAction({
        actionId: grantedActionId(base(SRD_BASIC_ACTION_IDS.DASH), nimbleEscapeId, 0),
        heldEffects: [],
        standing,
        spentKeys: []
      })
    ).toThrow('The selected granted action is stale.')
    expect(() =>
      resolveGrantedAction({
        actionId: grantedActionId(base(SRD_BASIC_ACTION_IDS.HIDE), nimbleEscapeId, 0),
        heldEffects: [],
        spentKeys: []
      })
    ).toThrow('The selected granted action is stale.')
  })
})

describe('a granted action id', () => {
  const base = `${HOLDER_ID}:BASIC_ACTION:${SRD_BASIC_ACTION_IDS.DASH}:EFFECT:x`

  it('names the basic action and the offer, and a plain id names no offer', () => {
    const id = grantedActionId(base, HASTE_EFFECT_ID, 2)
    expect(parseGrantedActionId(id)).toEqual({
      baseActionId: base,
      effectId: HASTE_EFFECT_ID,
      offerIndex: 2
    })
    expect(parseGrantedActionId(base)).toBeNull()
  })

  it('resolves against the held effect and refuses it once the effect ended or no longer offers the action', () => {
    const id = grantedActionId(base, HASTE_EFFECT_ID, 0)
    const resolved = resolveGrantedAction({
      actionId: id,
      heldEffects: [hasteHeld()],
      spentKeys: []
    })
    expect(resolved).toMatchObject({ baseActionId: base, offer: { activation: 'FREE' } })
    expect(typeof resolved.useKey).toBe('string')
    expect(() => resolveGrantedAction({ actionId: id, heldEffects: [], spentKeys: [] })).toThrow(
      'The selected granted action is stale.'
    )
    // Expeditious Retreat offers only Dash, not Hide.
    const hide = grantedActionId(
      `${HOLDER_ID}:BASIC_ACTION:${SRD_BASIC_ACTION_IDS.HIDE}:EFFECT:x`,
      RETREAT_EFFECT_ID,
      0
    )
    expect(() =>
      resolveGrantedAction({ actionId: hide, heldEffects: [retreatHeld()], spentKeys: [] })
    ).toThrow('The selected granted action is stale.')
  })

  it('refuses a capped offer whose use is spent this turn', () => {
    const id = grantedActionId(base, HASTE_EFFECT_ID, 0)
    const { useKey } = resolveGrantedAction({
      actionId: id,
      heldEffects: [hasteHeld()],
      spentKeys: []
    })
    expect(() =>
      resolveGrantedAction({ actionId: id, heldEffects: [hasteHeld()], spentKeys: [useKey!] })
    ).toThrow('The selected granted action has no use left this turn.')
  })
})

describe('the source of a granted basic action', () => {
  const actor = srdCreatureActor({ id: HOLDER_ID, creature: wolf })
  const dashId = `${HOLDER_ID}:BASIC_ACTION:${SRD_BASIC_ACTION_IDS.DASH}:EFFECT:x`

  async function dashSource(
    granted: NonNullable<Parameters<typeof resolveEncounterActionSource>[0]['granted']>
  ) {
    const basicActions = await readEncounterBasicActionEntries({
      actorId: HOLDER_ID,
      actionId: dashId,
      gameSystemId: SRD_SYSTEM_ID,
      definitions: srdDefinitions
    })
    const [offered] = discoverEncounterBasicActions({
      actorId: HOLDER_ID,
      gameSystemId: SRD_SYSTEM_ID,
      entries: basicActions,
      conditionDefinitionIds: [],
      abilityDefinitions: SRD_ABILITIES
    }).available
    return resolveEncounterActionSource({
      spells: new Map(),
      actor,
      actionId: grantedActionId(offered!.actionId, HASTE_EFFECT_ID, 0),
      gameSystemId: SRD_SYSTEM_ID,
      system: srdSystemRecord,
      basicActions,
      granted
    })
  }

  it('spends the offer’s activation and use instead of the action’s own', async () => {
    const source = await dashSource({ heldEffects: [hasteHeld()], spentKeys: [] })
    if (source.kind !== 'BASIC_ACTION') throw new Error('Expected a basic action.')
    expect(source.capability.mechanicFacts.invocation.activation).toMatchObject({
      code: 'FREE',
      amount: 1
    })
    expect(source.grantedUseKey).toEqual(expect.any(String))
    expect(source.capability.definitionId).toBe(SRD_BASIC_ACTION_IDS.DASH)
  })

  it('is stale when the holder keeps no such effect', async () => {
    await expect(dashSource({ heldEffects: [], spentKeys: [] })).rejects.toThrow(
      'The selected granted action is stale.'
    )
  })
})
