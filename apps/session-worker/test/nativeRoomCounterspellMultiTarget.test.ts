import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { counterspell } from '@artificer-toolkit/source-data/srd/spells/counterspell.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { massHealingWord } from '@artificer-toolkit/source-data/srd/spells/mass-healing-word.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * REACTION-4.T3e-a (D127): a Character's cast on chosen creatures and its area cast offer a held
 * Counterspell before they do anything, as a single-target cast does. A countered cast spends its
 * slot and action and has no effect. The counter is its holder's own action (D219): it spends the
 * holder's slot and reaction when it commits, whether or not it cancels the cast it answers.
 */

const CASTER_ACTOR_ID = testUuid(0x7f0)
const CASTER_ID = testUuid(0x7f1)
const REACTOR_ACTOR_ID = testUuid(0x7f2)
const REACTOR_ID = testUuid(0x7f3)
const WOLF_IDS = [testUuid(0x7f4), testUuid(0x7f5)]
const SHIELD_ACTOR_ID = testUuid(0x7f6)
const SHIELD_ID = testUuid(0x7f7)
const SLOT_SPENT = (level: number) => [{ slotKey: `STANDARD:${level}`, used: 1 }]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Character caster and a Character holding Counterspell 100 px apart (10 ft), then two Wolves.
 * A 20 ft sphere at x = 400 catches both Wolves and the holder, but not the caster.
 */
function counterRoom(
  spell: SpellAuthored,
  label: string,
  reactorAt?: { x: number; y: number },
  reactorHurt = false
) {
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
      play: reactorHurt ? { currentHitPoints: 1 } : {},
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
  const answer = room.resolveCommand(decision, {
    kind: 'OPTION',
    optionId: pending.options[0].optionId
  })
  const used = await room.send(answer)
  expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
  return answer
}

async function decline(room: Room) {
  const { decision } = await offered(room)
  const declined = await room.resolve(decision, { kind: 'DECLINE' })
  expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
}

/** The holder’s spellcasting check against a cast above its slot, answered with one natural d20. */
async function rollTheCheck(room: Room, face: number) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the counter check.')
  const answer = room.resolveCommand(decision, {
    kind: 'ENTER_DICE',
    requestId: decision.pending.request.requestId,
    rawFaces: [face],
    rollMode: decision.pending.request.rollMode
  })
  const rolled = await room.send(answer)
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  return answer
}

/**
 * The Counterspell the room ran as its holder's own action against the Caster's cast, that cast, the
 * Run version each committed at and each one's receipt.
 */
async function readChildAndCast(room: Room) {
  const history = await readRoomHistory(room.room.base.stub)
  const rows = history.commands.filter((row) => row.commandType === 'RESOLVE_ACTION')
  const actions = rows.map((row) =>
    resolveEncounterActionInputDtoSchema.parse(JSON.parse(row.commandJson))
  )
  const child = actions.find((command) => command.systemTrigger?.trigger === 'REACTION')
  const cast = actions.find((command) => !command.systemTrigger)
  if (!child || !cast) throw new Error('The room ran no reaction child against a cast.')
  const executionOf = (commandId: string) => {
    const receipt = history.receipts.find((candidate) => candidate.commandId === commandId)
    if (!receipt) throw new Error('The action left no receipt.')
    return parseReceiptExecution(receipt)
  }
  return {
    child,
    cast,
    versions: Object.fromEntries(
      rows.map((row, index) => [actions[index]!.commandId, row.version])
    ),
    childExecution: executionOf(child.commandId),
    castExecution: executionOf(cast.commandId)
  }
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

async function voidOccurrence(room: Room, occurrence: { id: string; version: number }) {
  return room.send({
    type: 'VOID_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: room.room.encounterId,
    expectedVersion: await room.version(),
    occurrenceId: occurrence.id,
    expectedOccurrenceVersion: occurrence.version
  })
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
  const healRoom = (level: '3rd' | '4th' = '3rd', reactorHurt = false) =>
    counterRoom(massHealingWord, `Mass Healing Word (${level} level)`, undefined, reactorHurt)

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

  it('runs the counter as the holder’s own action and commits the cast it cancelled as lost, with no counter receipt (D219)', async () => {
    const room = await healRoom()
    await castOnWolves(room)
    const version = await room.version()
    await counterWithLowestSlot(room)

    const { child, cast, versions, childExecution, castExecution } = await readChildAndCast(room)
    expect(child).toMatchObject({
      actorId: REACTOR_ACTOR_ID,
      target: { kind: 'ACTOR', actorId: CASTER_ACTOR_ID },
      systemTrigger: { parentCommandId: cast.commandId, trigger: 'REACTION' }
    })
    // The child commits first, on the Run version the choice was made at; the cast it cancelled follows.
    expect(versions[child.commandId]).toBe(version + 1)
    expect(versions[cast.commandId]).toBe(version + 2)
    expect(childExecution.status).toBe('COMPLETE')
    if (
      castExecution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
      castExecution.applicationOutputs.kind !== 'ENCOUNTER_COUNTERED_CAST'
    )
      throw new Error(`Expected a countered cast, got ${castExecution.status}.`)
    expect(castExecution.applicationOutputs).not.toHaveProperty('counter')
    expect(castExecution.applicationOutputs.spellCastConsumption).not.toBeNull()
  })

  it('replays the counter, its check and the cast without spending or casting a second time', async () => {
    const room = await healRoom('4th')
    const { command, answer } = await room.startActorsAction(WOLF_IDS)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const choice = await counterWithLowestSlot(room)
    const check = await rollTheCheck(room, 1)
    await settle(room)
    const version = await room.version()
    const vitals = await creatureVitals(room)

    for (const replayed of [choice, check, command]) {
      const again = await room.send(replayed)
      expect(again.type, JSON.stringify(again)).toBe('COMMAND_COMMITTED')
    }
    expect(await room.version()).toBe(version)
    expect(await creatureVitals(room)).toEqual(vitals)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
  })

  it('resumes the cast past the reaction its first chosen creature spent on a failed counter', async () => {
    const room = await healRoom('4th', true)
    const holderHitPoints = await hitPointsOf(room, REACTOR_ID)
    await castOnWolves(room, [REACTOR_ACTOR_ID, WOLF_IDS[0]!])
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)

    // The holder paid in its own action, which changed the facts the held cast was sealed on.
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    await settle(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await hitPointsOf(room, REACTOR_ID)).toBeGreaterThan(holderHitPoints)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
  })

  /** A 4th-level Magic Missile throws six darts, all at the Shield holder, past a failed counter. */
  const shieldOfferedAfterFailedCounter = async () => {
    const room = await actionRoom({
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
        characterActor({ id: SHIELD_ACTOR_ID, characterId: SHIELD_ID })
      ],
      characterSpellcasting: { spells: [magicMissile], prepared: [magicMissile.id] },
      secondCharacter: {
        characterId: REACTOR_ID,
        spellcasting: { spells: [counterspell], prepared: [counterspell.id] }
      },
      thirdCharacter: {
        characterId: SHIELD_ID,
        play: { currentHitPoints: 8 },
        spellcasting: { spells: [shield], prepared: [shield.id] }
      },
      characterAction: (action) => action.label === 'Magic Missile (4th level)'
    })
    const before = await readRoomHistory(room.room.base.stub)
    await castOnWolves(
      room,
      Array.from({ length: 6 }, () => SHIELD_ACTOR_ID)
    )
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)
    return { room, before }
  }

  it('offers a chosen creature its Shield after a counter failed, the counter already paid for', async () => {
    const { room } = await shieldOfferedAfterFailedCounter()

    const { decision, pending } = await offered(room)
    expect(pending.targetActorId).toBe(SHIELD_ACTOR_ID)
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    expect(await slotsOf(room, SHIELD_ID)).toEqual([])
    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0].optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await hitPointsOf(room, SHIELD_ID)).toBe(8)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    expect(await slotsOf(room, SHIELD_ID)).toEqual(SLOT_SPENT(1))
  })

  it('gives back a failed counter’s slot and reaction when the GM voids the cast held at a chosen creature’s Shield', async () => {
    const { room, before } = await shieldOfferedAfterFailedCounter()
    const { decision } = await offered(room)
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    const voided = await voidOccurrence(room, decision.occurrence)
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect(await slotsOf(room, SHIELD_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('spends a failing holder’s slot in its own action, and the cast goes on; one undo restores all', async () => {
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
    const room = await healRoom('4th', true)
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
    const vitals = await creatureVitals(room)
    await castFireball(room)
    await counterWithLowestSlot(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(3))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    expect(await creatureVitals(room)).toEqual(vitals)
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

  it('spends a failing holder’s slot in its own gated action before the saves, the holder caught by the area, and one undo restores all', async () => {
    const room = await fireballRoom('4th')
    const before = await readRoomHistory(room.room.base.stub)
    const holderHitPoints = await hitPointsOf(room, REACTOR_ID)
    await castFireball(room)
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)

    // The failed counter committed as the holder's own action: it has paid before the saves are rolled.
    const decision = await room.pendingDecision()
    expect(decision.pending.kind).toBe('AREA_SAVES')
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
    await settle(room)

    const { child, cast, childExecution } = await readChildAndCast(room)
    expect(child.systemTrigger).toMatchObject({
      parentCommandId: cast.commandId,
      trigger: 'REACTION'
    })
    if (
      childExecution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
      childExecution.applicationOutputs.kind !== 'ENCOUNTER_GATED_ACTION'
    )
      throw new Error(`Expected a gated Counterspell, got ${childExecution.status}.`)
    expect(childExecution.applicationOutputs.lost).toBe('SPELL')

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

  it('replays the counter, its check and the area cast without spending or casting a second time', async () => {
    const room = await fireballRoom('4th')
    const { command, answer } = await room.startAreaAction({ x: 400, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const choice = await counterWithLowestSlot(room)
    const check = await rollTheCheck(room, 1)
    await settle(room)
    const version = await room.version()
    const history = await readRoomHistory(room.room.base.stub)

    for (const replayed of [choice, check, command]) {
      const again = await room.send(replayed)
      expect(again.type, JSON.stringify(again)).toBe('COMMAND_COMMITTED')
    }
    expect(await room.version()).toBe(version)
    expect(vitalsOf(await readRoomHistory(room.room.base.stub))).toEqual(vitalsOf(history))
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
  })

  it('spends a failing holder’s slot in its own action when the area does not catch the holder', async () => {
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

  it('gives back a failed counter’s slot and reaction when the GM voids the area at its saves', async () => {
    const room = await fireballRoom('4th')
    const before = await readRoomHistory(room.room.base.stub)
    await castFireball(room)
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)
    const saves = await room.pendingDecision()
    expect(saves.pending.kind).toBe('AREA_SAVES')
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    const voided = await voidOccurrence(room, saves.occurrence)
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)

    // The reaction is back: the same cast offers it again.
    await castFireball(room)
    await offered(room)
  })

  it('gives back a failed counter when the GM voids the area after a save was answered', async () => {
    const room = await fireballRoom('4th')
    const before = await readRoomHistory(room.room.base.stub)
    await castFireball(room)
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)
    const first = await room.pendingDecision()
    if (first.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const [save] = first.pending.saves
    const answered = await room.resolve(first, {
      kind: 'ENTER_DICE',
      requestId: save!.request.requestId,
      rawFaces: [1],
      rollMode: save!.request.rollMode
    })
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')

    const voided = await voidOccurrence(room, (await room.pendingDecision()).occurrence)
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('commits the area as the casters’ spends alone when the GM removes every creature it caught after a failed counter; one undo restores all', async () => {
    const room = await fireballRoom('4th', { x: 150, y: 650 })
    const before = await readRoomHistory(room.room.base.stub)
    const vitals = await creatureVitals(room)
    const { command, answer } = await room.startAreaAction({ x: 400, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)
    for (const wolfId of WOLF_IDS) {
      const removed = await room.send(
        room.removeAreaTargetCommand(await room.pendingDecision(), wolfId)
      )
      expect(removed.type, JSON.stringify(removed)).toBe('COMMAND_COMMITTED')
    }

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
    expect([...(roots[0]?.outputs.removedActorIds ?? [])].sort()).toEqual([...WOLF_IDS].sort())
    expect(children).toEqual([])
    expect(await creatureVitals(room)).toEqual(vitals)
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))

    await undoLastAction(room)
    expect(await slotsOf(room, CASTER_ID)).toEqual([])
    expect(await slotsOf(room, REACTOR_ID)).toEqual([])
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('spends a failing holder’s slot when the area catches nobody', async () => {
    const room = await fireballRoom('4th')
    const { answer } = await room.startAreaAction({ x: 150, y: 1400 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await counterWithLowestSlot(room)
    await rollTheCheck(room, 1)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await slotsOf(room, CASTER_ID)).toEqual(SLOT_SPENT(4))
    expect(await slotsOf(room, REACTOR_ID)).toEqual(SLOT_SPENT(3))
  })
})
