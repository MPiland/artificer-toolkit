import {
  reactionOfferCommandId,
  reactionOfferOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, biteWolf, type ActionRoomConfig } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingApplicationContext, readRoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-8.T1c2b1 (D219): an attack that has hit or missed a Character holding a reaction to that
 * outcome plans the Character's offer with the attack, its commit queues it, and the room raises it
 * as the Run's next decision. The trigger is the authored one, checked by the event table when the
 * attack is planned: the SRD Giant Killer (a Large or larger attacker within 5 feet that the
 * Character sees) and a homebrew reaction with other terms take the same path.
 */

const ATTACKER_ID = testUuid(0x8f0)
const REACTOR_ACTOR_ID = testUuid(0x8f1)
const REACTOR_ID = testUuid(0x8f2)
const attackBite = biteWolf('ATTACK', { reachFeet: 5 })
/** The same Wolf, Large. */
const largeWolf = creatureAuthoredDtoSchema.parse({ ...attackBite, size: 'LARGE' })

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const giantKillerOption = hunterConclave.features
  ?.find(({ label }) => label === "Hunter's Prey")
  ?.options?.find(({ label }) => label === 'Giant Killer')
if (!giantKillerOption?.effects) throw new Error('The SRD Hunter has no Giant Killer.')

/** The SRD option as the Character's Feature, exactly as authored. */
const giantKiller: ClassFeature = {
  id: giantKillerOption.id,
  label: giantKillerOption.label,
  description: giantKillerOption.description,
  availableAtLevel: 1,
  order: 1,
  effects: giantKillerOption.effects
}

/** A homebrew reaction authored as Giant Killer is, but answering only a hit, by an attacker of any size. */
const riposte = ((): ClassFeature => {
  const [effect] = giantKillerOption.effects
  if (!effect || !('reactionTrigger' in effect.invocation) || !effect.invocation.reactionTrigger)
    throw new Error('Giant Killer is not a reaction.')
  return {
    id: testUuid(0x8f7),
    label: 'Riposte',
    description: 'Attack a creature within 5 feet of you that hits you.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        ...effect,
        id: testUuid(0x8f8),
        invocation: {
          ...effect.invocation,
          range: { ...effect.invocation.range, id: testUuid(0x8f9) },
          reactionTrigger: {
            kind: 'ATTACK_RESOLVED_ON_SELF',
            outcome: 'HIT',
            requiresSight: false,
            attackerWithinFeet: 5
          }
        }
      }
    ]
  }
})()

/** A Wolf whose Bite (+4, reach 5 feet) attacks a Character 5 feet away, or at `reactorX` along the row. */
function attackedRoom(
  input: {
    creature?: typeof attackBite
    feature?: ClassFeature
    reactorX?: number
    sceneOverrides?: ActionRoomConfig['sceneOverrides']
  } = {}
) {
  const { creature = largeWolf } = input
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    positions: { [REACTOR_ACTOR_ID]: { x: input.reactorX ?? 250, y: 150 } },
    ownerFeatureId: creatureFeature(creature, 'Bite').id,
    characterClassFeatures: [input.feature ?? giantKiller],
    characterEquipment: [dagger],
    sceneOverrides: input.sceneOverrides
  })
}
type Room = Awaited<ReturnType<typeof attackedRoom>>

/**
 * The Bite at the Character, its d20 showing `face`. Off the Scene when `onScene` is false, where the
 * GM accepts that its range is not checked.
 */
async function bite(room: Room, face: number, onScene = true) {
  const started = onScene
    ? await room.startAction(REACTOR_ACTOR_ID, [], room.sceneContext())
    : await room.startAction(REACTOR_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const attack = await room.pendingDecision()
  if (attack.pending.kind !== 'D20_EVIDENCE')
    throw new Error(`Expected the attack prompt, got ${attack.pending.kind}.`)
  const { requestId, rollMode } = attack.pending.request
  const rolled = await room.resolve(attack, {
    kind: 'ENTER_DICE',
    requestId,
    rawFaces: rollMode === 'NORMAL' ? [face] : [face, face],
    rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  return started.command
}

/** The reaction offers the room holds, whatever their state. */
async function offers(room: Room, attackCommandId: string) {
  const offerId = reactionOfferOccurrenceId(attackCommandId, REACTOR_ACTOR_ID)
  return (await readRoomHistory(room.room.base.stub)).occurrences.filter(
    ({ id, rootCommandId }) => id === offerId || rootCommandId === reactionOfferCommandId(offerId)
  )
}

/** The room holds no reaction offer and waits on nothing. */
async function expectNoOffer(room: Room, attackCommandId: string) {
  expect(await offers(room, attackCommandId)).toEqual([])
  expect(
    (await readRoomHistory(room.room.base.stub)).occurrences.filter(
      ({ state }) => state === 'PENDING' || state === 'QUEUED'
    )
  ).toEqual([])
}

describe('the reaction offer of an attack that hit or missed its holder (QUALITY-8.T1c2b1)', () => {
  it.each([
    ['hits', 19],
    ['misses', 1]
  ])(
    'is raised for the Character once a Large Wolf’s Bite %s, as the Run’s pending decision',
    async (_outcome, face) => {
      const room = await attackedRoom()
      const command = await bite(room, face)
      const [offer, ...others] = await offers(room, command.commandId)
      expect(others).toEqual([])
      expect(offer).toMatchObject({
        id: reactionOfferOccurrenceId(command.commandId, REACTOR_ACTOR_ID),
        state: 'PENDING',
        version: 0,
        expectedEncounterVersion: await room.version()
      })
      const context = await readPendingApplicationContext(room.room.base.stub)
      if (context.kind !== 'ENCOUNTER_REACTION_OFFER')
        throw new Error(`Expected the reaction offer, got ${context.kind}.`)
      expect(context).toMatchObject({
        parentCommandId: command.commandId,
        reactorActorId: REACTOR_ACTOR_ID,
        attackerActorId: ATTACKER_ID,
        reactionAllowance: { definitionId: DND5E_REACTION_ALLOWANCE_DEFINITION_ID, beforeUsed: 0 }
      })
      // The menu is the Character's own reaction with each weapon it wields, labelled to tell them apart.
      expect(context.options.map(({ label }) => label)).toEqual([
        'Giant Killer (Club)',
        'Giant Killer (Dagger)'
      ])
      // The attack itself is settled: the offer answers a committed attack.
      const history = await readRoomHistory(room.room.base.stub)
      expect(history.occurrences.find(({ id }) => id === context.parentOccurrenceId)).toMatchObject(
        { rootCommandId: command.commandId, state: 'COMPLETED' }
      )
    }
  )

  it('offers nothing against a Wolf smaller than the reaction names', async () => {
    const room = await attackedRoom({ creature: attackBite })
    await expectNoOffer(room, (await bite(room, 19)).commandId)
  })

  it('offers nothing when the Wolf is farther than the reaction names', async () => {
    const room = await attackedRoom({
      creature: creatureAuthoredDtoSchema.parse({
        ...biteWolf('ATTACK', { reachFeet: 10 }),
        size: 'LARGE'
      }),
      reactorX: 350
    })
    await expectNoOffer(room, (await bite(room, 19)).commandId)
  })

  it('offers nothing to a Character that cannot see the Wolf', async () => {
    const room = await attackedRoom({
      sceneOverrides: { ambientIllumination: 'ORDINARY_DARKNESS' }
    })
    await expectNoOffer(room, (await bite(room, 19)).commandId)
  })

  it('offers nothing for an attack made off the Scene', async () => {
    const room = await attackedRoom()
    await expectNoOffer(room, (await bite(room, 19, false)).commandId)
  })

  it('offers a homebrew reaction by its own terms: a hit by a Wolf of any size, seen or not', async () => {
    const hit = await attackedRoom({
      creature: attackBite,
      feature: riposte,
      sceneOverrides: { ambientIllumination: 'ORDINARY_DARKNESS' }
    })
    const [offer] = await offers(hit, (await bite(hit, 19)).commandId)
    expect(offer).toMatchObject({ state: 'PENDING' })
    const context = await readPendingApplicationContext(hit.room.base.stub)
    if (context.kind !== 'ENCOUNTER_REACTION_OFFER')
      throw new Error(`Expected the reaction offer, got ${context.kind}.`)
    expect(context.options.map(({ label }) => label)).toEqual([
      'Riposte (Club)',
      'Riposte (Dagger)'
    ])

    const missed = await attackedRoom({ creature: attackBite, feature: riposte })
    await expectNoOffer(missed, (await bite(missed, 1)).commandId)
  })
})
