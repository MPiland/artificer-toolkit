import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { ghost } from '@artificer-toolkit/source-data/srd/creatures/ghost.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readActorConditionIds,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-15.T3l: an unmodified SRD Ghost's Horrifying Visage, whose failed save frightens beside a
 * GM ruling (the aging) in the same result block, frightens each Wolf that fails and holds the fear
 * in one repeat-save effect per Wolf, in one commit.
 */

const GHOST_ID = testUuid(0xc00)
const FIRST_ID = testUuid(0xc01)
const SECOND_ID = testUuid(0xc02)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const FRIGHTENED = SRD_CONDITION_TYPES.find(({ code }) => code === 'FRIGHTENED')?.id

/** The Ghost at (150, 150) and two Wolves 5 and 10 feet east of it, inside its 60-foot sphere. */
async function visageRoom() {
  const creature = installedSrdCreature(ghost)
  const feature = creature.features.find(({ label }) => label === 'Horrifying Visage')
  if (!feature) throw new Error('The Ghost has no Horrifying Visage.')
  return actionRoom({
    rolls: [1, 1],
    actors: [
      srdCreatureActor({ id: GHOST_ID, creature }),
      ...[FIRST_ID, SECOND_ID].map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: feature.id
  })
}

describe('an unmodified SRD Ghost’s Horrifying Visage', () => {
  it('frightens the Wolf that fails and holds its fear in a repeat-save effect, in one commit', async () => {
    const room = await visageRoom()
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    const started = await room.startCasterCenteredAreaAction()
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [FIRST_ID, SECOND_ID].sort()
    )
    // The first Wolf fails the DC 13 Wisdom save on a 1; the second passes on a 20.
    for (const [actorId, face] of [
      [SECOND_ID, 20],
      [FIRST_ID, 1]
    ] as const) {
      const pending = await room.pendingDecision()
      if (pending.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
      const save = pending.pending.saves.find((entry) => entry.actorId === actorId)
      if (!save) throw new Error('The Wolf has no pending save.')
      const answered = await room.send(
        room.resolveCommand(pending, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: [face],
          rollMode: save.request.rollMode
        })
      )
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    }
    expect(await readPendingActionDecision(stub)).toBeNull()

    const committed = await readRoomHistory(stub)
    expect(
      committed.commands.slice(before.commands.length).map((entry) => entry.commandType)
    ).toEqual(['RESOLVE_ACTION'])
    expect(readActorConditionIds(committed, FIRST_ID)).toContain(FRIGHTENED)
    expect(readActorConditionIds(committed, SECOND_ID)).not.toContain(FRIGHTENED)
    const repeats = committed.activeEffects.filter(
      ({ definitionJson }) => JSON.parse(definitionJson).frozenGraphNodeId === 'repeat-save-test'
    )
    expect(repeats.map(({ targetActorId }) => targetActorId)).toEqual([FIRST_ID])
    const { recurrence } = JSON.parse(repeats[0]!.definitionJson)
    // "for 1 minute" is ten rounds; the frightened Wolf repeats the save at the end of its turns.
    expect(recurrence.expiration).toMatchObject({ kind: 'TICKS', initialRemaining: 10 })
    expect(recurrence.recurrenceStage).toBe('END_OF_TURN')
  })
})
