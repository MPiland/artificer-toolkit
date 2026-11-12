import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acidSplash } from '@artificer-toolkit/source-data/srd/spells/acid-splash.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { scorchingRay } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'
import { unfilteredShield } from './unfilteredShield.js'

/**
 * QUALITY-13.T1b: a list of chosen creatures that waits on a roll per creature runs the same cast
 * window and per-creature preparation as one that commits at once. A chosen creature answers being
 * chosen (D137) before its save or the ray at it is rolled, and a creature holding an after-the-roll
 * die is shown its save (D168).
 */

const CASTER_ACTOR_ID = testUuid(0x9a0)
const CASTER_ID = testUuid(0x9a1)
const REACTOR_ACTOR_ID = testUuid(0x9a2)
const REACTOR_ID = testUuid(0x9a3)
const FIRST_WOLF_ID = testUuid(0x9a4)
const SECOND_WOLF_ID = testUuid(0x9a5)
const FIRST_DIE_ID = testUuid(0x9a6)
const SECOND_DIE_ID = testUuid(0x9a7)
const REACTOR_HIT_POINTS = 8
// The 1d6 acid and the first of a ray's 2d6: a raw die is its face less one.
const ACID_DAMAGE = 3
const RAY_DAMAGE = 1 + 2
const SHIELD_SLOT = [{ slotKey: 'STANDARD:1', used: 1 }]
const FAIL = 1

afterEach(() => {
  closeTrackedSockets()
})

/** A Caster who knows `spell`, next to a Character holding `reactorSpell` (or none). */
function reactorRoom(options: {
  spell: SpellAuthored
  label: string
  rolls: readonly number[]
  reactorSpell?: SpellAuthored | null
}) {
  const { spell, label, rolls, reactorSpell = unfilteredShield } = options
  return actionRoom({
    // The two stand a cell apart, out of each other's reach.
    sceneGrid: {
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 30,
      diagonalPolicy: 'EQUAL',
      unit: 'FEET'
    },
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterPlay: { currentHitPoints: 5 },
    secondCharacter: {
      characterId: REACTOR_ID,
      play: { currentHitPoints: REACTOR_HIT_POINTS },
      spellcasting: reactorSpell
        ? { spells: [reactorSpell], prepared: [reactorSpell.id] }
        : undefined
    },
    characterAction: (action) => action.label === label,
    rolls,
    fallbackRoll: 5
  })
}
type Room = Awaited<ReturnType<typeof reactorRoom>>

const splashRoom = () => reactorRoom({ spell: acidSplash, label: 'Acid Splash', rolls: [2] })

const readPlay = (room: Room, characterId: string) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === characterId)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row)
  })
const slotsOf = async (room: Room, characterId: string) =>
  (await readPlay(room, characterId)).spellSlots ?? []
const reactorHitPoints = async (room: Room) => (await readPlay(room, REACTOR_ID)).hitpoints.current
const effectIds = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id)

async function cast(room: Room, targets: readonly string[]) {
  const { answer } = await room.startActorsAction(targets, [], true)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The reaction choice the room asks of the chosen Character. */
async function offered(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

async function pendingRolls(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES')
    throw new Error(`Expected the pending rolls, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The one pending roll, answered with a natural d20 face; the answer must commit. */
async function answerRoll(room: Room, face: number) {
  const { decision, pending } = await pendingRolls(room)
  const [roll] = pending.saves
  if (!roll) throw new Error('No roll is pending.')
  const answer = await room.send(
    room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: roll.request.requestId,
      rawFaces: [face],
      rollMode: roll.request.rollMode
    })
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

async function useReaction(room: Room) {
  const { decision, pending } = await offered(room)
  const used = await room.resolve(decision, {
    kind: 'OPTION',
    optionId: pending.options[0]!.optionId
  })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
}

async function undoLastAction(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('a chosen creature answers being chosen before its save (QUALITY-13.T1b)', () => {
  it('offers the reaction before any save is asked, applying and spending nothing', async () => {
    const room = await splashRoom()
    await cast(room, [REACTOR_ACTOR_ID])

    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await effectIds(room)).toEqual([])
  }, 120000)

  it('asks the save once the reaction is used, and lands its effect and cost with the save', async () => {
    const room = await splashRoom()
    await cast(room, [REACTOR_ACTOR_ID])
    await useReaction(room)

    const { pending } = await pendingRolls(room)
    expect(pending.saves.map(({ actorId }) => actorId)).toEqual([REACTOR_ACTOR_ID])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await effectIds(room)).toEqual([])

    await answerRoll(room, FAIL)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS - ACID_DAMAGE)
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SHIELD_SLOT)
    expect(await effectIds(room)).toHaveLength(1)

    await undoLastAction(room)
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await effectIds(room)).toEqual([])
  }, 120000)

  it('asks the save when the reaction is declined, spending and applying nothing of it', async () => {
    const room = await splashRoom()
    await cast(room, [REACTOR_ACTOR_ID])
    const { decision } = await offered(room)
    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    await answerRoll(room, FAIL)
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS - ACID_DAMAGE)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await effectIds(room)).toEqual([])
  }, 120000)
})

describe('a chosen creature answers being chosen before the ray at it (QUALITY-13.T1b)', () => {
  // A natural face that hits the Character's Armor Class as it stands and misses it five higher.
  const NARROW_HIT = 12
  const rayRoom = (reactorSpell: SpellAuthored | null) =>
    reactorRoom({
      spell: scorchingRay,
      label: 'Scorching Ray (2nd level)',
      rolls: [0, 1],
      reactorSpell
    })

  it('hits a Character that holds no reaction', async () => {
    const room = await rayRoom(null)
    await cast(room, [REACTOR_ACTOR_ID])
    await answerRoll(room, NARROW_HIT)
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS - RAY_DAMAGE)
  }, 120000)

  it('rolls the ray against the Armor Class the used reaction leaves, so the same roll misses', async () => {
    const room = await rayRoom(unfilteredShield)
    await cast(room, [REACTOR_ACTOR_ID])
    await useReaction(room)

    const { pending } = await pendingRolls(room)
    expect(pending.saves.map(({ targetActorId }) => targetActorId)).toEqual([REACTOR_ACTOR_ID])
    await answerRoll(room, NARROW_HIT)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await reactorHitPoints(room)).toBe(REACTOR_HIT_POINTS)
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SHIELD_SLOT)
    expect(await effectIds(room)).toHaveLength(1)
  }, 120000)
})

describe('a chosen creature holding an after-the-roll die is shown its save (QUALITY-13.T1b)', () => {
  const holdsDie = (actorId: string, id: string) =>
    seedModifierGrant({
      sourceActorId: actorId,
      holderActorId: actorId,
      lifecycle: {},
      effect: heldSaveDieEffect(),
      sourceLabel: resistance.label,
      id
    })

  it('opens one window at a time once every save is rolled, the earliest in initiative first', async () => {
    const seeds = [holdsDie(FIRST_WOLF_ID, FIRST_DIE_ID), holdsDie(SECOND_WOLF_ID, SECOND_DIE_ID)]
    const room = await actionRoom({
      actors: [
        characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        ...[FIRST_WOLF_ID, SECOND_WOLF_ID].map((id) =>
          srdCreatureActor({
            id,
            creature: { ...plainWolf, hitPoints: 20 },
            currentHitPoints: 20
          })
        )
      ],
      characterSpellcasting: { spells: [acidSplash], prepared: [acidSplash.id] },
      characterPlay: { currentHitPoints: 5 },
      characterAction: (action) => action.label === 'Acid Splash',
      rolls: [2],
      fallbackRoll: 5,
      seed: async (context) => {
        for (const seed of seeds) await seed(context)
      }
    })
    const wolfHitPoints = async () =>
      Object.fromEntries(
        vitalsOf(await readRoomHistory(room.room.base.stub))
          .filter(({ id }) => id !== CASTER_ACTOR_ID)
          .map((actor) => [actor.id, actor.currentHitPoints])
      )
    const heldDieIds = async () =>
      (await readRoomHistory(room.room.base.stub)).activeEffects.map(({ id }) => id).sort()

    await cast(room, [FIRST_WOLF_ID, SECOND_WOLF_ID])
    // The later creature rolls first; the windows still open in initiative order.
    for (const actorId of [SECOND_WOLF_ID, FIRST_WOLF_ID]) {
      const { decision, pending } = await pendingRolls(room)
      const save = pending.saves.find((candidate) => candidate.actorId === actorId)
      if (!save) throw new Error('The creature has no save to roll.')
      const answer = await room.send(
        room.resolveCommand(decision, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: [FAIL],
          rollMode: save.request.rollMode
        })
      )
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    }

    const first = await pendingRolls(room)
    expect(first.pending.saves).toEqual([])
    expect(first.pending.windows.map(({ targetActorId }) => targetActorId)).toEqual([FIRST_WOLF_ID])
    const used = await room.send(
      room.resolveCommand(first.decision, {
        kind: 'ROLL_WINDOW_USE',
        requestId: first.pending.windows[0]!.requestId,
        optionId: first.pending.windows[0]!.options[0]!.optionId,
        faces: [1]
      })
    )
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const second = await pendingRolls(room)
    expect(second.pending.windows.map(({ targetActorId }) => targetActorId)).toEqual([
      SECOND_WOLF_ID
    ])
    const declined = await room.send(
      room.resolveCommand(second.decision, {
        kind: 'ROLL_WINDOW_DECLINE',
        requestId: second.pending.windows[0]!.requestId
      })
    )
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    // Both saves still fail; the spent die ends with the cast and the declined one stays.
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await wolfHitPoints()).toEqual({
      [FIRST_WOLF_ID]: 20 - ACID_DAMAGE,
      [SECOND_WOLF_ID]: 20 - ACID_DAMAGE
    })
    expect(await heldDieIds()).toEqual([SECOND_DIE_ID])
  }, 120000)
})
