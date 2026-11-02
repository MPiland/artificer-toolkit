import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { afterEach, describe, expect, it } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { heldSaveDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T4c1b4: an area save whose creature holds an after-the-roll die opens the d20 window once
 * every save is rolled, one creature at a time in initiative order, however the saves were rolled.
 */

const CASTER_ID = testUuid(0x950)
const FIRST_ID = testUuid(0x951)
const SECOND_ID = testUuid(0x952)
const FIRST_DIE_ID = testUuid(0x953)
const SECOND_DIE_ID = testUuid(0x954)

afterEach(() => {
  closeTrackedSockets()
})

const holdsDie = (actorId: string, id: string) =>
  seedModifierGrant({
    sourceActorId: actorId,
    holderActorId: actorId,
    lifecycle: {},
    effect: heldSaveDieEffect(),
    sourceLabel: resistance.label,
    id
  })

/** The Caster's area catches both Wolves, each holding Resistance's die; the First acts before the Second. */
function twoHoldersRoom() {
  const seeds = [holdsDie(FIRST_ID, FIRST_DIE_ID), holdsDie(SECOND_ID, SECOND_DIE_ID)]
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      srdCreatureActor({ id: FIRST_ID, creature: plainWolf }),
      srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
    ],
    ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id,
    seed: async (context) => {
      for (const seed of seeds) await seed(context)
    }
  })
}
type Room = Awaited<ReturnType<typeof twoHoldersRoom>>

async function area(room: Room) {
  const decision = await readPendingActionDecision(room.room.base.stub)
  if (decision?.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
  return { decision, pending: decision.pending }
}

async function rollSave(room: Room, actorId: string) {
  const { decision, pending } = await area(room)
  const save = pending.saves.find((candidate) => candidate.actorId === actorId)
  if (!save) throw new Error('The creature has no save to roll.')
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

const heldDieIds = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).activeEffects.map(({ id }) => id).sort()

describe('area saves with held after-the-roll dice (SPELLS-31.T4c1b4)', () => {
  it('opens one window at a time, the earliest in initiative first, whoever rolled first', async () => {
    const room = await twoHoldersRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    for (const actorId of [SECOND_ID, FIRST_ID])
      while ((await area(room)).pending.saves.some((save) => save.actorId === actorId))
        await rollSave(room, actorId)
    // The Caster's own save, when caught, is rolled like the rest.
    while ((await area(room)).pending.saves.length > 0) {
      const [save] = (await area(room)).pending.saves
      await rollSave(room, save!.actorId)
    }

    const first = await area(room)
    expect(first.pending.windows.map(({ targetActorId }) => targetActorId)).toEqual([FIRST_ID])

    const used = await room.send(
      room.resolveCommand(first.decision, {
        kind: 'ROLL_WINDOW_USE',
        requestId: first.pending.windows[0]!.requestId,
        optionId: first.pending.windows[0]!.options[0]!.optionId,
        faces: [4]
      })
    )
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')

    const second = await area(room)
    expect(second.pending.windows.map(({ targetActorId }) => targetActorId)).toEqual([SECOND_ID])
    const declined = await room.send(
      room.resolveCommand(second.decision, {
        kind: 'ROLL_WINDOW_DECLINE',
        requestId: second.pending.windows[0]!.requestId
      })
    )
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')

    // The spent die ends with the area; the declined one stays.
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await heldDieIds(room)).toEqual([SECOND_DIE_ID])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await heldDieIds(room)).toEqual([FIRST_DIE_ID, SECOND_DIE_ID].sort())
  })
})
