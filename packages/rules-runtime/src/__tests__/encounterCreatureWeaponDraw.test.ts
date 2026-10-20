import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { planNativeEncounterActionMechanics } from '../encounterActionMechanicsPlan.js'
import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import {
  creatureFeature,
  srdCreatureActor,
  srdCreatureTarget,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'

const ACTOR_ID = testUuid(0xd1)
const TARGET_ID = testUuid(0xd2)

const ogre = prepareSrdImport()
  .subjects.filter((subject) => subject.subjectKind === 'CREATURE')
  .map((subject) => creatureAuthoredDtoSchema.parse(subject.document) as CreatureAuthored)
  .find((creature) => creature.label === 'Ogre')!

/** The Ogre with its main-hand Greatclub put away (carried), so an attack must draw it. */
const carrying = {
  ...ogre,
  equipmentLoadout: ogre.equipmentLoadout?.map((entry) =>
    entry.useState === 'MAIN_HAND' ? { ...entry, useState: 'CARRIED' as const } : entry
  )
}

async function attack(
  creature: CreatureAuthored,
  label: string,
  handHolds: number,
  actionIndex = 0
) {
  const actor = srdCreatureActor({ id: ACTOR_ID, creature })
  const target = srdCreatureActor({ id: TARGET_ID, creature: ogre })
  const actors = [actor, target]
  const featureId = creatureFeature(creature, label).id
  const capability = discoverEncounterFeatureActions({
    actor,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  }).available.filter((entry) => entry.ownerFeatureId === featureId)[actionIndex]
  if (!capability) throw new Error(`The Ogre offers no ${label} action.`)
  const prepare = () =>
    prepareEncounterActionMechanics({
      state: srdEncounterState({ actors, currentActorId: actor.id }),
      actor,
      target,
      actors,
      actionId: capability.actionId,
      wieldConflictAcceptance: { kind: 'PROMPTED', accepted: null, handHolds },
      overridable: true,
      movementTargets: new Map(actors.map((entry) => [entry.id, srdCreatureTarget(entry)])),
      loadSource: async (input) =>
        resolveEncounterActionSource({ ...input, system: srdSystemRecord }),
      loadRelationshipFacts: async () => [],
      loadTurnUses: async () => []
    })
  return { actor, prepare }
}

describe('a Creature attack draws its carried loadout weapon (D107, ATTACK-19.2)', () => {
  it('draws a carried Greatclub into the free hands and plans the draw as a receipt transition', async () => {
    const { prepare } = await attack(carrying, 'Greatclub', 0)
    const prepared = await prepare()
    expect(prepared.weaponDraw).toMatchObject({ kind: 'DRAW', slot: 'MAIN_HAND' })
    const plan = planNativeEncounterActionMechanics(
      {
        prepared,
        encounterId: prepared.state.id,
        expectedEncounterVersion: prepared.state.version,
        occurrenceId: testUuid(0xd3),
        sourceCommandId: testUuid(0xd4),
        commandId: testUuid(0xd4),
        occurredAt: TIMESTAMP,
        applications: []
      },
      testUuid(0xd5)
    )
    expect(plan.sourceItemDraw).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_ITEM_DRAW',
      actorId: ACTOR_ID,
      slot: 'MAIN_HAND'
    })
  })

  it('draws nothing for a weapon already in hand', async () => {
    const { prepare } = await attack(ogre, 'Greatclub', 0)
    expect((await prepare()).weaponDraw).toEqual({ kind: 'NONE' })
  })

  it('refuses the attack while a held creature fills a hand the club needs', async () => {
    const { prepare } = await attack(carrying, 'Greatclub', 1)
    await expect(prepare()).rejects.toThrow('Release a held creature first')
  })
})

describe('a Creature thrown attack leaves its hand (D107, ATTACK-19.3)', () => {
  const bugbear = prepareSrdImport()
    .subjects.filter((subject) => subject.subjectKind === 'CREATURE')
    .map((subject) => creatureAuthoredDtoSchema.parse(subject.document) as CreatureAuthored)
    .find((creature) => creature.label === 'Bugbear')!
  const javelinFeatureId = creatureFeature(bugbear, 'Javelin').id
  /** The Bugbear with its Javelin in hand and its Morningstar put away. */
  const javelinInHand = {
    ...bugbear,
    equipmentLoadout: bugbear.equipmentLoadout?.map((entry) => ({
      ...entry,
      useState: entry.actionFeatureIds.includes(javelinFeatureId)
        ? ('MAIN_HAND' as const)
        : entry.useState === 'MAIN_HAND'
          ? ('CARRIED' as const)
          : entry.useState
    }))
  }
  const planThrow = (
    prepared: Awaited<ReturnType<Awaited<ReturnType<typeof attack>>['prepare']>>
  ) =>
    planNativeEncounterActionMechanics(
      {
        prepared,
        encounterId: prepared.state.id,
        expectedEncounterVersion: prepared.state.version,
        occurrenceId: testUuid(0xd3),
        sourceCommandId: testUuid(0xd4),
        commandId: testUuid(0xd4),
        occurredAt: TIMESTAMP,
        applications: []
      },
      testUuid(0xd5)
    )

  it('throws the held Javelin out of its hand and plans the throw as a receipt transition', async () => {
    const { prepare } = await attack(javelinInHand, 'Javelin', 0, 1)
    const prepared = await prepare()
    expect(prepared.weaponDraw).toMatchObject({ kind: 'THROW' })
    expect(planThrow(prepared).sourceItemDraw).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_ITEM_DRAW',
      actorId: ACTOR_ID,
      movement: 'THROW'
    })
  })

  it('does not move the Javelin when the melee action uses it', async () => {
    const { prepare } = await attack(javelinInHand, 'Javelin', 0, 0)
    expect((await prepare()).weaponDraw.kind).not.toBe('THROW')
  })
})
