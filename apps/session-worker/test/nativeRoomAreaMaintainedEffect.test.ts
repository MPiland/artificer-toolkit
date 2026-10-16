import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { concentrationFrightSphere, frightenedId } from './areaConditionFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-19.T2: a point-area action whose per-creature outcome a Concentration maintains keeps one
 * maintained state across every creature it caught; ending the Concentration, or the GM's undo,
 * removes the effect from all of them.
 */

const CHARACTER_ACTOR_ID = testUuid(0x7e0)
const CHARACTER_ID = testUuid(0x7e1)
const CAUGHT_IDS = [testUuid(0x7e2), testUuid(0x7e3)]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Character casting the Concentration sphere at x = 50, which reaches them and both Wolves. */
function frightRoom() {
  const spell = concentrationFrightSphere()
  return actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
      srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label === 'Fright Sphere (1st level)'
  })
}

type FrightRoom = Awaited<ReturnType<typeof frightRoom>>

/** Answers every save the area waits on with a failing 1. */
async function failAllSaves(room: FrightRoom) {
  for (;;) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') return
    const [save] = decision.pending.saves
    if (!save) return
    const answer = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [1],
        rollMode: save.request.rollMode
      })
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  }
}

async function castAndFailEverySave(room: FrightRoom) {
  const { answer } = await room.startAreaAction({ x: 50, y: 150 })
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await failAllSaves(room)
}

const streamVersionOf = (room: FrightRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return row.streamVersion
  })

/** The GM ends the caster's Concentration through the Character's Sheet. */
async function gmEndsConcentration(room: FrightRoom) {
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'CHARACTER_SHEET',
    characterId: CHARACTER_ID,
    encounterId: room.room.encounterId,
    command: {
      type: 'END_CONCENTRATION',
      commandId,
      expectedVersion: await streamVersionOf(room)
    }
  })
}

const effectsOnEveryCreature = (history: Awaited<ReturnType<typeof readRoomHistory>>) => ({
  wolves: history.activeEffects.map((effect) => effect.targetActorId).sort(),
  character: history.characterEffects.length
})

describe('room point-area Concentration spell that frightens (SPELLS-19.T2)', () => {
  it('keeps one Concentration holding the effect on every creature the area frightens', async () => {
    const room = await frightRoom()
    await castAndFailEverySave(room)

    const committed = await readRoomHistory(room.room.base.stub)
    expect(committed.maintainedStates).toHaveLength(1)
    const [state] = committed.maintainedStates
    expect(state?.ownerActorId).toBe(CHARACTER_ACTOR_ID)
    expect(effectsOnEveryCreature(committed)).toEqual({
      wolves: [...CAUGHT_IDS].sort(),
      character: 1
    })
    for (const effect of [...committed.activeEffects, ...committed.characterEffects])
      expect(effect.maintainedEffectStateId).toBe(state?.id)
  })

  it('removes the effect and its condition from every creature when the caster ends Concentration', async () => {
    const room = await frightRoom()
    await castAndFailEverySave(room)
    expect((await readRoomHistory(room.room.base.stub)).activeEffects.length).toBe(
      CAUGHT_IDS.length
    )

    const ended = await gmEndsConcentration(room)
    expect(ended.type, JSON.stringify(ended)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.room.base.stub)
    expect(after.maintainedStates).toEqual([])
    expect(after.activeEffects).toEqual([])
    expect(after.characterEffects).toEqual([])
    for (const vitals of vitalsOf(after))
      expect(
        (vitals.conditions as { conditionTypeId: string }[]).map(
          ({ conditionTypeId }) => conditionTypeId
        )
      ).not.toContain(frightenedId())
  })

  it('ends the earlier Concentration on every creature once when the caster concentrates again, and refuses its undo', async () => {
    const room = await frightRoom()
    await castAndFailEverySave(room)
    const [first] = (await readRoomHistory(room.room.base.stub)).maintainedStates

    // Both casts use the turn's one Action: the second is a soft override.
    const { answer } = await room.startAreaAction({ x: 50, y: 150 }, ['ACTION_ECONOMY_UNAVAILABLE'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await failAllSaves(room)

    const replaced = await readRoomHistory(room.room.base.stub)
    const [second] = replaced.maintainedStates
    expect(replaced.maintainedStates).toHaveLength(1)
    expect(second?.id).not.toBe(first?.id)
    expect(effectsOnEveryCreature(replaced)).toEqual({
      wolves: [...CAUGHT_IDS].sort(),
      character: 1
    })
    for (const effect of [...replaced.activeEffects, ...replaced.characterEffects])
      expect(effect.maintainedEffectStateId).toBe(second?.id)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE',
      message: expect.stringContaining('a replaced maintained effect')
    })
  })

  it('takes the Concentration and the effect from every creature with one undo', async () => {
    const room = await frightRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await castAndFailEverySave(room)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')

    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.maintainedStates).toEqual([])
    expect(reverted.activeEffects).toEqual([])
    expect(reverted.characterEffects).toEqual([])
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
  })
})
