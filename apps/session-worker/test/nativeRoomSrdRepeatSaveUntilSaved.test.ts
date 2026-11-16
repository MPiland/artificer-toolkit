import { MAX_ACTIVE_EFFECT_TURNS } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { vrock } from '@artificer-toolkit/source-data/srd/creatures/vrock.js'
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
 * QUALITY-15.T3r: an unmodified SRD Vrock's Spores, whose failed save poisons with no duration of its
 * own until a repeated save ends it, poisons each Wolf that fails and holds the poison in one
 * repeat-save effect per Wolf that lasts until its save ends it, in one commit.
 */

const VROCK_ID = testUuid(0xc10)
const FIRST_ID = testUuid(0xc11)
const SECOND_ID = testUuid(0xc12)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const POISONED = SRD_CONDITION_TYPES.find(({ code }) => code === 'POISONED')?.id

/** The Vrock and two Wolves 5 and 10 feet east of it, inside its 15-foot sphere. */
async function sporesRoom() {
  const creature = installedSrdCreature(vrock)
  const feature = creature.features.find(({ label }) => label === 'Spores (Recharge 6)')
  if (!feature) throw new Error('The Vrock has no Spores.')
  return actionRoom({
    rolls: [1, 1],
    actors: [
      srdCreatureActor({ id: VROCK_ID, creature }),
      ...[FIRST_ID, SECOND_ID].map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: feature.id
  })
}

describe('an unmodified SRD Vrock’s Spores', () => {
  it('poisons the Wolf that fails and holds the poison until its repeated save ends it, in one commit', async () => {
    const room = await sporesRoom()
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    const started = await room.startCasterCenteredAreaAction()
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [FIRST_ID, SECOND_ID].sort()
    )
    // The first Wolf fails the DC 14 Constitution save on a 1; the second passes on a 20.
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
    expect(readActorConditionIds(committed, FIRST_ID)).toContain(POISONED)
    expect(readActorConditionIds(committed, SECOND_ID)).not.toContain(POISONED)
    const repeats = committed.activeEffects.filter(
      ({ definitionJson }) => JSON.parse(definitionJson).frozenGraphNodeId === 'repeat-save-test'
    )
    expect(repeats.map(({ targetActorId }) => targetActorId)).toEqual([FIRST_ID])
    const { recurrence } = JSON.parse(repeats[0]!.definitionJson)
    // No duration of its own: the poisoned Wolf repeats the save at the end of its turns until made.
    expect(recurrence.expiration).toMatchObject({
      kind: 'TICKS',
      initialRemaining: MAX_ACTIVE_EFFECT_TURNS
    })
    expect(recurrence.recurrenceStage).toBe('END_OF_TURN')
  })
})
