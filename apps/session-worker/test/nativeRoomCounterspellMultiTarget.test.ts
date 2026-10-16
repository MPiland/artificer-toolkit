import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { massHealingWord } from '@artificer-toolkit/source-data/srd/spells/mass-healing-word.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * REACTION-4.T3e-a (D127): a Character's cast on chosen creatures and its area cast offer a held
 * Counterspell before they do anything, as a single-target cast does. A countered cast spends its
 * slot and action and has no effect; a failed counter is spent with the cast's terminal commit.
 */

const CASTER_ACTOR_ID = testUuid(0x7f0)
const CASTER_ID = testUuid(0x7f1)
const REACTOR_ACTOR_ID = testUuid(0x7f2)
const REACTOR_ID = testUuid(0x7f3)
const WOLF_IDS = [testUuid(0x7f4), testUuid(0x7f5)]
const SLOT_SPENT = (level: number) => [{ slotKey: `STANDARD:${level}`, used: 1 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Character caster and a Character holding Counterspell 100 px apart (10 ft), then two Wolves.
 * A 20 ft sphere at x = 400 catches both Wolves and the holder, but not the caster.
 */
function counterRoom(spell: SpellAuthored, label: string, reactorAt?: { x: number; y: number }) {
  return actionRoom({
    sceneGrid: {
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 10,
      diagonalPolicy: 'EQUAL',
      unit: 'FEET'
    },
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      characterActor({ id: REACTOR_ACTOR_ID, characterId: REACTOR_ID }),
      ...WOLF_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf, currentHitPoints: 1 }))
    ],
    ...(reactorAt && { positions: { [REACTOR_ACTOR_ID]: reactorAt } }),
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterPlay: { currentHitPoints: 1 },
    secondCharacter: {
      characterId: REACTOR_ID,
      play: {},
      spellcasting: { spells: [counterspell], prepared: [counterspell.id] }
    },
    characterAction: (action) => action.label === label
  })
}
type Room = Awaited<ReturnType<typeof counterRoom>>

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
const hitPointsOf = async (room: Room, characterId: string) =>
  (await readPlay(room, characterId)).hitpoints.current
const creatureVitals = async (room: Room) =>
  vitalsOf(await readRoomHistory(room.room.base.stub)).filter(({ id }) => WOLF_IDS.includes(id))

/** The reaction choice the room asks of the Counterspell holder. */
async function offered(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'REACTION_CHOICE')
    throw new Error(`Expected the reaction choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The holder counters with its lowest slot. */
async function counterWithLowestSlot(room: Room) {
  const { decision, pending } = await offered(room)
  const used = await room.resolve(decision, {
    kind: 'OPTION',
    optionId: pending.options[0].optionId
  })
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
}

async function decline(room: Room) {
  const { decision } = await offered(room)
  const declined = await room.resolve(decision, { kind: 'DECLINE' })
  expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
}

/** The holder's spellcasting check against a cast above its slot, answered with one natural d20. */
async function rollTheCheck(room: Room, face: number) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the counter check.')
  const rolled = await room.resolve(decision, {
    kind: 'ENTER_DICE',
    requestId: decision.pending.request.requestId,
    rawFaces: [face],
    rollMode: decision.pending.request.rollMode
  })
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
}

/** Answers every save and outcome die the cast still waits on with its lowest face. */
async function settle(room: Room) {
  for (;;) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (!decision) return
    const { pending } = decision
    if (pending.kind === 'AREA_SAVES') {
      const [save] = pending.saves
      if (!save) return
      const answered = await room.resolve(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [1],
        rollMode: save.request.rollMode
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    } else if (pending.kind === 'ACTION_OUTCOME_EVIDENCE') {
      const answered = await room.resolve(decision, {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: pending.request.min
      })
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    } else throw new Error(`Unexpected pending decision ${pending.kind}.`)
  }
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

const castOnWolves = async (room: Room, targets: readonly string[] = WOLF_IDS) => {
  const { answer } = await room.startActorsAction(targets)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}
const castFireball = async (room: Room) => {
  const { answer } = await room.startAreaAction({ x: 400, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

describe('room Counterspell against a Character’s cast on chosen creatures (REACTION-4.T3e)', () => {
  const healRoom = (level: '3rd' | '4th' = '3rd') =>
    counterRoom(massHealingWord, `Mass Healing Word (${level} level)`)

  it('holds the cast for the holder’s choice, applying and spending nothing', async () => {
    const room = await healRoom()
    const before = await creatureVitals(room)
    await castOnWolves(room)

    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    expect(await creatureVitals(room)).toEqual(before)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('counters the cast when used: both slots are spent, nobody is healed, and one undo restores all', async () => {
    const room = await healRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const vitals = await creatureVitals(room)
    await castOnWolves(room)
    await counterWithLowestSlot(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await creatureVitals(room)).toEqual(vitals)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(3))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    await undoLastAction(room)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)

    // The reaction is back: the same cast offers it again.
    await castOnWolves(room)
    await offered(room)
  })

  it('lets the cast resolve when declined, spending nothing of the holder', async () => {
    const room = await healRoom()
    const vitals = await creatureVitals(room)
    await castOnWolves(room)
    await decline(room)
    await settle(room)

    expect(await creatureVitals(room)).not.toEqual(vitals)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(3))
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('replays the decline without casting a second time', async () => {
    const room = await healRoom()
    await castOnWolves(room)
    const { decision } = await offered(room)
    const answer = room.resolveCommand(decision, { kind: 'DECLINE' })
    expect((await room.send(answer)).type).toBe('COMMAND_COMMITTED')
    await settle(room)
    const version = await room.version()

    expect((await room.send(answer)).type).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(version)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(3))
  })

  it('spends a failing holder’s slot with the cast, which goes on; one undo restores all', async () => {
    const room = await healRoom('4th')
    const before = await readRoomHistory(room.room.base.stub)
    const vitals = await creatureVitals(room)
    await castOnWolves(room)
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)
    await settle(room)

    expect(await creatureVitals(room)).not.toEqual(vitals)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    await undoLastAction(room)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('spends a failing holder’s slot through its own write when the holder is also a chosen creature', async () => {
    const room = await healRoom('4th')
    const before = await readRoomHistory(room.room.base.stub)
    const holderHitPoints = await hitPointsOf(room, REACTOR_ID)
    await castOnWolves(room, [WOLF_IDS[0]!, REACTOR_ACTOR_ID])
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)
    await settle(room)

    expect(await hitPointsOf(room, REACTOR_ID)).toBeGreaterThan(holderHitPoints)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    await undoLastAction(room)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await hitPointsOf(room, REACTOR_ID)).toBe(holderHitPoints)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })
})

describe('room Counterspell against a Character’s area cast (REACTION-4.T3e)', () => {
  const fireballRoom = (level: '3rd' | '4th' = '3rd', reactorAt?: { x: number; y: number }) =>
    counterRoom(fireball, `Fireball (${level} level)`, reactorAt)

  it('holds the cast before any save is asked, applying and spending nothing', async () => {
    const room = await fireballRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await castFireball(room)

    const { pending } = await offered(room)
    expect(pending.targetActorId).toBe(REACTOR_ACTOR_ID)
    expect(pending.allowedResponses).toEqual(['DECLINE', 'OPTION'])
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.actors).toEqual(before.actors)
    expect(areaReceipts(history).roots).toEqual([])
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('counters the cast when used: no save is asked, both slots are spent, nobody is hurt, and one undo restores all', async () => {
    const room = await fireballRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const holderHitPoints = await hitPointsOf(room, REACTOR_ID)
    await castFireball(room)
    await counterWithLowestSlot(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(3))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    expect(vitalsOf(await readRoomHistory(room.room.base.stub))).toEqual(vitalsOf(before))
    expect(await hitPointsOf(room, REACTOR_ID)).toBe(holderHitPoints)

    await undoLastAction(room)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)

    await castFireball(room)
    await offered(room)
  })

  it('goes on to the saves when declined, spending nothing of the holder', async () => {
    const room = await fireballRoom()
    const before = vitalsOf(await readRoomHistory(room.room.base.stub))
    await castFireball(room)
    await decline(room)

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [REACTOR_ACTOR_ID, ...WOLF_IDS].sort()
    )
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    await settle(room)

    expect(vitalsOf(await readRoomHistory(room.room.base.stub))).not.toEqual(before)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(3))
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
  })

  it('spends a failing holder’s slot with the area’s commit, the holder caught by it, and one undo restores all', async () => {
    const room = await fireballRoom('4th')
    const before = await readRoomHistory(room.room.base.stub)
    const holderHitPoints = await hitPointsOf(room, REACTOR_ID)
    await castFireball(room)
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)

    // The failed counter waits with the cast's saves: nothing is spent yet.
    const decision = await room.pendingDecision()
    expect(decision.pending.kind).toBe('AREA_SAVES')
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    await settle(room)

    expect(await hitPointsOf(room, REACTOR_ID)).toBeLessThan(holderHitPoints)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    const { roots } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)

    await undoLastAction(room)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('spends a failing holder’s slot with the area’s commit when the area does not catch the holder', async () => {
    const room = await fireballRoom('4th', { x: 150, y: 650 })
    const before = await readRoomHistory(room.room.base.stub)
    await castFireball(room)
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)
    await settle(room)

    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    await undoLastAction(room)
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('spends a failing holder’s slot when the area catches nobody', async () => {
    const room = await fireballRoom('4th')
    const { answer } = await room.startAreaAction({ x: 150, y: 2000 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
  })
})
