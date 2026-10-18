import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
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
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  characterActor,
  srdCondition,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const HOLDER_ID = testUuid(0xe501)
const wolf = srdByLabel(SRD.creatures, 'Wolf')

type Predicate = 'FREE_HAND' | 'CAN_ACT' | 'SPEED_ABOVE_ZERO' | 'CHARACTER_LEVEL' | 'CREATURE_TYPE'

type Condition = {
  predicateCode: Predicate
  constraint?: 'EXCLUDE'
  creatureTypeIds?: readonly string[]
}

/** One group per holder kind, each AND-ing the same predicates, as a basic action is authored. */
function restrictedTo(...conditions: Condition[]) {
  return restrictedFor(['CHARACTER', 'CREATURE'], ...conditions)
}

/** One OR-group per subject in `subjects`, each AND-ing `conditions` on that subject. */
function restrictedFor(
  subjects: readonly ('CHARACTER' | 'CREATURE')[],
  ...conditions: Condition[]
) {
  return {
    id: testUuid(0xe510),
    groups: subjects.map((subject, groupIndex) => ({
      id: testUuid(0xe511 + groupIndex * 0x100),
      order: groupIndex + 1,
      contexts: [
        {
          id: testUuid(0xe512 + groupIndex * 0x100),
          order: 1,
          subject,
          ...(subject === 'CREATURE' ? { authoringModeKind: 'ALL' as const } : {}),
          conditions: conditions.map(({ predicateCode, constraint, creatureTypeIds }, index) => ({
            id: testUuid(0xe520 + groupIndex * 0x100 + index),
            order: index + 1,
            kind: 'PREDICATE' as const,
            constraint: constraint ?? ('INCLUDE' as const),
            predicateCode,
            ...(predicateCode === 'CHARACTER_LEVEL' ? { min: 20 } : {}),
            ...(creatureTypeIds
              ? { authoringModeKind: 'SELECTED' as const, creatureTypeIds: [...creatureTypeIds] }
              : {})
          }))
        }
      ]
    }))
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

const stateOf = (
  target: Parameters<typeof encounterHolderState>[0]['target'],
  runEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]> = new Map()
) =>
  encounterHolderState({
    target,
    gameSystemId: SRD_SYSTEM_ID,
    definitions: srdDefinitions,
    speedDefinitions: SRD_SPEEDS,
    runEffectsByActorId
  })

type RelationshipModule = Extract<
  Extract<ActiveRuleEffectRecord['definition'], { schemaVersion: 2 }>['stateContributions'][number],
  { kind: 'ACTOR_RELATIONSHIP' }
>['modules'][number]

/** A creature `sourceActorId` holds through a relationship carrying `modules`. */
function heldBy(index: number, sourceActorId: string, modules: RelationshipModule[]) {
  const heldActorId = testUuid(0xe540 + index)
  return [
    heldActorId,
    [
      activeEffect({
        id: testUuid(0xe550 + index),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: heldActorId },
        createdOrdinal: index,
        sourceActorId,
        stateContributions: [
          {
            kind: 'ACTOR_RELATIONSHIP',
            relationshipOutcomeId: testUuid(0xe560),
            modules,
            conditionIds: [],
            capabilitySuppressions: []
          }
        ]
      })
    ]
  ] as const
}

const occupiesHand: RelationshipModule = {
  id: testUuid(0xe570),
  order: 0,
  kind: 'SOURCE_OCCUPIES_HAND'
}

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
    expect(await stateOf(creatureHolder([loadoutEntry(1, club.id, 'MAIN_HAND')]))).toMatchObject({
      freeHand: true
    })
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

describe('FREE_HAND counts each creature the holder holds by hand', () => {
  const oneHanded = [loadoutEntry(1, club.id, 'MAIN_HAND')]

  it('fails when a hand-held creature fills the hand a weapon left free', async () => {
    expect(
      await stateOf(creatureHolder(oneHanded), new Map([heldBy(1, HOLDER_ID, [occupiesHand])]))
    ).toMatchObject({ freeHand: false })
  })

  it('fails when two hand-held creatures fill both empty hands, and holds with one', async () => {
    expect(
      await stateOf(creatureHolder([]), new Map([heldBy(1, HOLDER_ID, [occupiesHand])]))
    ).toMatchObject({ freeHand: true })
    expect(
      await stateOf(
        creatureHolder([]),
        new Map([heldBy(1, HOLDER_ID, [occupiesHand]), heldBy(2, HOLDER_ID, [occupiesHand])])
      )
    ).toMatchObject({ freeHand: false })
  })

  it('ignores a relationship without the hand module and one another creature holds', async () => {
    expect(
      await stateOf(
        creatureHolder(oneHanded),
        new Map([
          heldBy(1, HOLDER_ID, [{ id: testUuid(0xe571), order: 0, kind: 'SOURCE_FOLLOWS_TARGET' }]),
          heldBy(2, testUuid(0xe5ff), [occupiesHand])
        ])
      )
    ).toMatchObject({ freeHand: true })
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
  const full = [loadoutEntry(1, club.id, 'MAIN_HAND'), loadoutEntry(2, shieldWood.id, 'OFF_HAND')]

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
    expect(encounterBasicActionRestrictionsHold(handsFull, await stateOf(creatureHolder([])))).toBe(
      false
    )
  })

  it('evaluates a restriction on another facet through the same check', async () => {
    const canAct = restrictedTo({ predicateCode: 'CAN_ACT' })
    const open = await stateOf(creatureHolder([]))
    const incapacitated = await stateOf(creatureHolder([], [srdCondition('Incapacitated')]))
    expect(encounterBasicActionRestrictionsHold(canAct, open)).toBe(true)
    expect(encounterBasicActionRestrictionsHold(canAct, incapacitated)).toBe(false)
    const both = restrictedTo({ predicateCode: 'CAN_ACT' }, { predicateCode: 'FREE_HAND' })
    expect(encounterBasicActionRestrictionsHold(both, incapacitated)).toBe(false)
    expect(encounterBasicActionRestrictionsHold(both, await stateOf(creatureHolder(full)))).toBe(
      false
    )
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

describe('each facet context gates on the holder kind', () => {
  const canAct = { predicateCode: 'CAN_ACT' } as const

  it('holds a CHARACTER-only group for a Character and never for a Creature', async () => {
    const characterOnly = restrictedFor(['CHARACTER'], canAct)
    expect(
      encounterBasicActionRestrictionsHold(characterOnly, await stateOf(await fighterHolder([])))
    ).toBe(true)
    expect(
      encounterBasicActionRestrictionsHold(characterOnly, await stateOf(creatureHolder([])))
    ).toBe(false)
  })

  it('holds a CREATURE-only group for a Creature and never for a Character', async () => {
    const creatureOnly = restrictedFor(['CREATURE'], canAct)
    expect(
      encounterBasicActionRestrictionsHold(creatureOnly, await stateOf(creatureHolder([])))
    ).toBe(true)
    expect(
      encounterBasicActionRestrictionsHold(creatureOnly, await stateOf(await fighterHolder([])))
    ).toBe(false)
  })

  it('reads CREATURE_TYPE against the Creature holder type', async () => {
    const ofType = (creatureTypeIds: readonly string[]) =>
      restrictedFor(['CREATURE'], { predicateCode: 'CREATURE_TYPE', creatureTypeIds })
    const wolfState = await stateOf(creatureHolder([]))
    expect(encounterBasicActionRestrictionsHold(ofType([wolf.creatureTypeId]), wolfState)).toBe(
      true
    )
    expect(encounterBasicActionRestrictionsHold(ofType([testUuid(0xe5fe)]), wolfState)).toBe(false)
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
