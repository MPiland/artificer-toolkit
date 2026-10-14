import { describe, expect, it } from 'vitest'
import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import {
  SRD_ABILITIES,
  SRD_SPEEDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { resolveEncounterActionSource } from '../encounterActionSources.js'
import {
  discoverEncounterBasicActions,
  readEncounterBasicActionEntries
} from '../encounterBasicActionCapabilityDiscovery.js'
import { encounterBasicActionRestrictionsHold } from '../encounterBasicActionRestrictions.js'
import { encounterHolderState } from '../encounterHolderDefense.js'
import { buildMovementTarget, type CharacterMovementFacts } from '../encounterMovementTargets.js'
import { prepareFixtureSheet, readyFighterFixture } from '../testing/characterContextFixtures.js'
import {
  CAMPAIGN_ID,
  SRD_SYSTEM_ID,
  characterActor,
  srdCondition,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from './dnd5eSrdCharacter.js'

const HOLDER_ID = testUuid(0xe501)
const wolf = srdByLabel(SRD.creatures, 'Wolf')

type Predicate = 'FREE_HAND' | 'CAN_ACT' | 'SPEED_ABOVE_ZERO' | 'CHARACTER_LEVEL'

/** One OR-group of AND-ed holder predicates, the way a basic action's restrictions are authored. */
function restrictedTo(...conditions: { predicateCode: Predicate; constraint?: 'EXCLUDE' }[]) {
  return {
    id: testUuid(0xe510),
    groups: [
      {
        id: testUuid(0xe511),
        order: 1,
        contexts: [
          {
            id: testUuid(0xe512),
            order: 1,
            subject: 'CHARACTER' as const,
            conditions: conditions.map(({ predicateCode, constraint }, index) => ({
              id: testUuid(0xe520 + index),
              order: index + 1,
              kind: 'PREDICATE' as const,
              constraint: constraint ?? ('INCLUDE' as const),
              predicateCode,
              ...(predicateCode === 'CHARACTER_LEVEL' ? { min: 20 } : {})
            }))
          }
        ]
      }
    ]
  } as FacetDto
}

const freeHandOnly = restrictedTo({ predicateCode: 'FREE_HAND' })

const loadoutEntry = (index: number, equipmentId: string, useState: 'MAIN_HAND' | 'OFF_HAND') => ({
  id: testUuid(0xe530 + index),
  equipmentId,
  quantity: 1,
  useState,
  attuned: false,
  actionFeatureIds: []
})

/** The Wolf carrying `equipmentLoadout`: its hands hold what the loadout puts in them (D107). */
function creatureHolder(
  equipmentLoadout: ReturnType<typeof loadoutEntry>[],
  conditionIds: readonly string[] = []
) {
  return srdCreatureTarget(
    srdCreatureActor({
      id: HOLDER_ID,
      creature: { ...wolf, equipmentLoadout },
      conditionIds
    })
  )
}

const stateOf = (target: Parameters<typeof encounterHolderState>[0]['target']) =>
  encounterHolderState({
    target,
    gameSystemId: SRD_SYSTEM_ID,
    definitions: srdDefinitions,
    speedDefinitions: SRD_SPEEDS
  })

/** A Fighter whose sheet the real fact builders produced, holding what `equipped` puts in hand. */
async function fighterHolder(equipped: { equipmentId: string; slot: 'MAIN_HAND' | 'OFF_HAND' }[]) {
  const fixture = readyFighterFixture()
  const character = {
    ...fixture.character,
    state: {
      ...fixture.character.state,
      equipment: {
        inventory: equipped.map(({ equipmentId }, index) => ({
          id: `held-${index}`,
          equipmentId,
          quantity: 1
        })),
        equipped: equipped.map(({ slot }, index) => ({ itemId: `held-${index}`, slot })),
        attuned: []
      }
    }
  }
  const sheet = await prepareFixtureSheet({
    character,
    documents: { ...fixture.documents, EQUIPMENT: [club, greatclub, shieldWood] }
  })
  const characterFacts: CharacterMovementFacts = {
    active: { id: character.id, checksum: 'a'.repeat(64), play: { streamVersion: 1 } },
    character: sheet.prepared.character,
    campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
    prepared: sheet.prepared,
    ruleEvaluation: sheet.ruleEvaluation
  }
  return buildMovementTarget({
    actor: characterActor({ id: HOLDER_ID, characterId: character.id }),
    activeEffects: [],
    characterFacts,
    campaignId: CAMPAIGN_ID,
    gameSystemId: SRD_SYSTEM_ID
  })
}

describe('FREE_HAND reads the hand occupancy of a Creature loadout', () => {
  it('holds with no loadout and with one one-handed weapon', async () => {
    expect(await stateOf(creatureHolder([]))).toMatchObject({ freeHand: true })
    expect(
      await stateOf(creatureHolder([loadoutEntry(1, club.id, 'MAIN_HAND')]))
    ).toMatchObject({ freeHand: true })
  })

  it('fails once a weapon and a shield fill both hands', async () => {
    expect(
      await stateOf(
        creatureHolder([
          loadoutEntry(1, club.id, 'MAIN_HAND'),
          loadoutEntry(2, shieldWood.id, 'OFF_HAND')
        ])
      )
    ).toMatchObject({ freeHand: false })
  })

  it('fails while a two-handed weapon blocks the off hand', async () => {
    expect(
      await stateOf(creatureHolder([loadoutEntry(1, greatclub.id, 'MAIN_HAND')]))
    ).toMatchObject({ freeHand: false })
  })
})

describe('FREE_HAND reads the hand occupancy of a Character', () => {
  it('holds with empty hands and one weapon in hand', async () => {
    expect(await stateOf(await fighterHolder([]))).toMatchObject({ freeHand: true })
    expect(
      await stateOf(await fighterHolder([{ equipmentId: club.id, slot: 'MAIN_HAND' }]))
    ).toMatchObject({ freeHand: true })
  })

  it('fails with a weapon and a shield, and with a two-handed weapon', async () => {
    expect(
      await stateOf(
        await fighterHolder([
          { equipmentId: club.id, slot: 'MAIN_HAND' },
          { equipmentId: shieldWood.id, slot: 'OFF_HAND' }
        ])
      )
    ).toMatchObject({ freeHand: false })
    expect(
      await stateOf(await fighterHolder([{ equipmentId: greatclub.id, slot: 'MAIN_HAND' }]))
    ).toMatchObject({ freeHand: false })
  })
})

describe('basic action restrictions', () => {
  const full = [
    loadoutEntry(1, club.id, 'MAIN_HAND'),
    loadoutEntry(2, shieldWood.id, 'OFF_HAND')
  ]

  it('offers an unrestricted action to every actor, hands full or not', async () => {
    for (const restrictions of [null, undefined]) {
      expect(
        encounterBasicActionRestrictionsHold(restrictions, await stateOf(creatureHolder(full)))
      ).toBe(true)
      expect(
        encounterBasicActionRestrictionsHold(restrictions, await stateOf(creatureHolder([])))
      ).toBe(true)
    }
  })

  it('offers a FREE_HAND action only while a hand is free', async () => {
    const hold = async (target: Parameters<typeof stateOf>[0]) =>
      encounterBasicActionRestrictionsHold(freeHandOnly, await stateOf(target))
    expect(await hold(creatureHolder(full))).toBe(false)
    expect(await hold(creatureHolder([full[0]!]))).toBe(true)
    expect(await hold(await fighterHolder([]))).toBe(true)
    expect(
      await hold(
        await fighterHolder([
          { equipmentId: club.id, slot: 'MAIN_HAND' },
          { equipmentId: shieldWood.id, slot: 'OFF_HAND' }
        ])
      )
    ).toBe(false)
  })

  it('inverts FREE_HAND for an EXCLUDE constraint', async () => {
    const handsFull = restrictedTo({ predicateCode: 'FREE_HAND', constraint: 'EXCLUDE' })
    expect(
      encounterBasicActionRestrictionsHold(handsFull, await stateOf(creatureHolder(full)))
    ).toBe(true)
    expect(
      encounterBasicActionRestrictionsHold(handsFull, await stateOf(creatureHolder([])))
    ).toBe(false)
  })

  it('evaluates a restriction on another facet through the same check', async () => {
    const canAct = restrictedTo({ predicateCode: 'CAN_ACT' })
    const open = await stateOf(creatureHolder([]))
    const incapacitated = await stateOf(
      creatureHolder([], [srdCondition('Incapacitated')])
    )
    expect(encounterBasicActionRestrictionsHold(canAct, open)).toBe(true)
    expect(encounterBasicActionRestrictionsHold(canAct, incapacitated)).toBe(false)
    const both = restrictedTo({ predicateCode: 'CAN_ACT' }, { predicateCode: 'FREE_HAND' })
    expect(encounterBasicActionRestrictionsHold(both, incapacitated)).toBe(false)
    expect(
      encounterBasicActionRestrictionsHold(both, await stateOf(creatureHolder(full)))
    ).toBe(false)
    expect(encounterBasicActionRestrictionsHold(both, open)).toBe(true)
  })

  it('fails closed on a condition an Encounter cannot decide here', async () => {
    expect(
      encounterBasicActionRestrictionsHold(
        restrictedTo({ predicateCode: 'CHARACTER_LEVEL' }),
        await stateOf(creatureHolder([]))
      )
    ).toBe(false)
  })

  it('reads a CREATURE-subject context the same way', async () => {
    const asCreature = {
      ...freeHandOnly,
      groups: freeHandOnly.groups.map((group) => ({
        ...group,
        contexts: group.contexts.map((context) => ({ ...context, subject: 'CREATURE' as const }))
      }))
    } as FacetDto
    expect(
      encounterBasicActionRestrictionsHold(asCreature, await stateOf(creatureHolder(full)))
    ).toBe(false)
    expect(
      encounterBasicActionRestrictionsHold(asCreature, await stateOf(creatureHolder([])))
    ).toBe(true)
  })
})

describe('a copy of the catalogue keeps its restrictions', () => {
  const HOMEBREW_SYSTEM_ID = testUuid(0xe5a0)
  const COPY_ID = testUuid(0xe5a1)
  const holds = async (restrictions: FacetDto | null, loadout: ReturnType<typeof loadoutEntry>[]) =>
    encounterBasicActionRestrictionsHold(restrictions, await stateOf(creatureHolder(loadout)))

  /** The SRD's Dash re-homed to `gameSystemId` with a FREE_HAND restriction added. */
  async function copyOfDash(gameSystemId: string) {
    const dash = await srdDefinitions.requireCurrent(SRD_BASIC_ACTION_IDS.DASH)
    const document = { ...dash.document, id: COPY_ID, gameSystemId, restrictions: freeHandOnly }
    return { ...dash, id: COPY_ID, gameSystemId, document }
  }

  it("carries them onto the offered capability of the Run's System", async () => {
    const copy = await copyOfDash(SRD_SYSTEM_ID)
    const entries = await readEncounterBasicActionEntries({
      actorId: HOLDER_ID,
      actionId: `${HOLDER_ID}:BASIC_ACTION:${COPY_ID}:EFFECT:x`,
      gameSystemId: SRD_SYSTEM_ID,
      definitions: { requireCurrent: async () => copy }
    })
    const { available } = discoverEncounterBasicActions({
      actorId: HOLDER_ID,
      gameSystemId: SRD_SYSTEM_ID,
      entries,
      conditionDefinitionIds: [],
      abilityDefinitions: SRD_ABILITIES
    })
    expect(available).toMatchObject([{ definitionId: COPY_ID, restrictions: freeHandOnly }])
  })

  it('applies them under another System id, as a homebrew copy is read', async () => {
    const copy = await copyOfDash(HOMEBREW_SYSTEM_ID)
    const [entry] = await readEncounterBasicActionEntries({
      actorId: HOLDER_ID,
      actionId: `${HOLDER_ID}:BASIC_ACTION:${COPY_ID}:EFFECT:x`,
      gameSystemId: HOMEBREW_SYSTEM_ID,
      definitions: { requireCurrent: async () => copy }
    })
    expect(entry?.document.restrictions).toEqual(freeHandOnly)
    expect(await holds(entry!.document.restrictions, [])).toBe(true)
    expect(
      await holds(entry!.document.restrictions, [
        loadoutEntry(1, club.id, 'MAIN_HAND'),
        loadoutEntry(2, shieldWood.id, 'OFF_HAND')
      ])
    ).toBe(false)
  })
})

describe('a basic action source exists only where the catalogue entries are read', () => {
  const actor = srdCreatureActor({ id: HOLDER_ID, creature: wolf })
  const actionId = `${HOLDER_ID}:BASIC_ACTION:${SRD_BASIC_ACTION_IDS.DASH}:EFFECT:x`
  const source = { actor, actionId, gameSystemId: SRD_SYSTEM_ID, system: srdSystemRecord }

  it('resolves the source of a catalogue entry the caller read', async () => {
    const basicActions = await readEncounterBasicActionEntries({
      actorId: HOLDER_ID,
      actionId,
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
    expect(
      resolveEncounterActionSource({ ...source, actionId: offered!.actionId, basicActions })
    ).toMatchObject({ kind: 'BASIC_ACTION' })
  })

  it('is stale for a caller that reads none, as the area, movement and Disarm paths load sources', () => {
    expect(() => resolveEncounterActionSource(source)).toThrow(
      'The selected basic action source is stale.'
    )
  })
})
