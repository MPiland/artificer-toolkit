import {
  srdCreatureActor,
  characterActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { freshRepeatSpell } from '@artificer-toolkit/rules-runtime/testing/freshRepeatSpell'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2lb2b1 (D186): the caster of a homebrew Concentration spell picks a fresh creature each
 * turn. A creature that saved is refused, and the new target joins the live Concentration.
 */

const CHARACTER_ACTOR_ID = testUuid(0xb10)
const CHARACTER_ID = testUuid(0xb11)
const SAVED_WOLF_ID = testUuid(0xb12)
const FRESH_WOLF_ID = testUuid(0xb13)

/** No Scene measures the range (D11). */
const RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

type ActionRoom = Awaited<ReturnType<typeof actionRoom>>

async function settlePendingAction(room: ActionRoom) {
  const { stub } = room.room.base
  for (
    let decision = await readPendingActionDecision(stub);
    decision;
    decision = await readPendingActionDecision(stub)
  ) {
    expect((await room.rollDice(decision)).type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(stub)).evidenceRolls.at(-1)
    if (!held || !('request' in decision.pending)) throw new Error('The roll was not held.')
    const settled = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: decision.pending.request.requestId,
      rollId: held.id
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
  }
}

/** The Character, who prepares Dread Gaze, then two Wolves. The first save shows a 20, the rest a 1. */
async function dreadGazeRoom() {
  const wolf = biteWolf('ATTACK')
  const spell = freshRepeatSpell()
  return actionRoom({
    rolls: [19],
    fallbackRoll: 0,
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: SAVED_WOLF_ID, creature: wolf }),
      srdCreatureActor({ id: FRESH_WOLF_ID, creature: wolf })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label.startsWith(spell.label)
  })
}

describe('room fresh repeat offer (SPELLS-4.T2lb2b1)', () => {
  it('lets the caster pick a new creature each turn, refuses the one that saved, and keeps the Concentration', async () => {
    const room = await dreadGazeRoom()
    const cast = await room.startAction(
      SAVED_WOLF_ID,
      RANGE,
      null,
      null,
      room.actionId,
      CHARACTER_ACTOR_ID
    )
    expect(cast.answer.type, JSON.stringify(cast.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)
    const maintained = (await readRoomHistory(room.room.base.stub)).maintainedStates
    expect(maintained).toHaveLength(1)

    const [offer] = (await room.actionChoices()).effectOffers
    expect(offer).toMatchObject({ kind: 'REPEAT_SOURCE_PATH', target: 'FRESH' })
    if (offer?.kind !== 'REPEAT_SOURCE_PATH') throw new Error('Expected the repeat offer.')

    // The pick is once a turn: a full round later the Character's action is back.
    for (let turn = 0; turn < 3; turn += 1) await room.advanceTurn()

    const refused = await room.startAction(SAVED_WOLF_ID, RANGE, null, null, offer.actionId)
    expect(refused.answer.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(refused.answer)).toContain('Immune to Dread Gaze')

    const repeat = await room.startAction(FRESH_WOLF_ID, RANGE, null, null, offer.actionId)
    expect(repeat.answer.type, JSON.stringify(repeat.answer)).toBe('COMMAND_COMMITTED')
    await settlePendingAction(room)

    const history = await readRoomHistory(room.room.base.stub)
    expect(history.maintainedStates).toEqual(maintained)
    expect(history.activeEffects.some(({ targetActorId }) => targetActorId === FRESH_WOLF_ID)).toBe(
      true
    )
    expect((await room.actionChoices()).effectOffers).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.maintainedStates).toEqual(maintained)
    expect(
      reverted.activeEffects.some(({ targetActorId }) => targetActorId === FRESH_WOLF_ID)
    ).toBe(false)
  }, 120000)
})
