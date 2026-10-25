import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { Dnd5eOptionalCombatRuleKindDto } from '@artificer-toolkit/schema/shared/optionalCombat'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0x13a0)
const FIRST_TARGET_ID = testUuid(0x13a1)
const SECOND_TARGET_ID = testUuid(0x13a2)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * ATTACK-13.T1: a Wolf whose Bite reaches 20 ft, beside two plain Wolves, in that turn order. Every
 * die shows its minimum, so the Bites miss: the mark comes from the attack, not the hit, and the
 * reach shows it follows the attack's melee classification rather than its distance.
 */
function markingRoom(optionalCombatKinds: readonly Dnd5eOptionalCombatRuleKindDto[]) {
  const attacker = biteWolf('ATTACK', { reachFeet: 20 })
  return actionRoom({
    autoRoll: 'GAME_MASTER',
    fallbackRoll: 0,
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
      srdCreatureActor({ id: FIRST_TARGET_ID, creature: plainWolf }),
      srdCreatureActor({ id: SECOND_TARGET_ID, creature: plainWolf })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    optionalCombatKinds
  })
}

type MarkingRoom = Awaited<ReturnType<typeof markingRoom>>

/** The attacker's Bite at the Scene token of the target at `targetIndex`. */
async function bite(room: MarkingRoom, targetActorId: string, targetIndex: number) {
  const { answer } = await room.startAction(targetActorId, [], room.sceneContext(targetIndex))
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The marks the attacker holds on creatures: the effects it gave, by holder. */
async function marks(room: MarkingRoom) {
  return (await readRoomHistory(room.room.base.stub)).activeEffects
    .map(({ targetActorId, definitionJson }) => ({
      targetActorId,
      definition: JSON.parse(definitionJson)
    }))
    .filter(
      ({ definition }) =>
        definition.origin?.kind === 'ENCOUNTER' && definition.origin.sourceActorId === ATTACKER_ID
    )
    .map(({ targetActorId }) => targetActorId)
}

/** Ends turns until the attacker's next turn begins. */
async function untilAttackerTurn(room: MarkingRoom) {
  for (let turn = 0; turn < 3; turn++) await room.advanceTurn()
}

describe('room Marking (ATTACK-13.T1)', () => {
  it('marks a melee target until the end of the attacker’s next turn', async () => {
    const room = await markingRoom(['MARK'])
    await bite(room, FIRST_TARGET_ID, 1)
    expect(await marks(room)).toEqual([FIRST_TARGET_ID])

    await untilAttackerTurn(room)
    expect(await marks(room)).toEqual([FIRST_TARGET_ID])

    await room.advanceTurn()
    expect(await marks(room)).toEqual([])
  }, 120000)

  it('moves the attacker’s one mark to its new target, and an undo moves it back', async () => {
    const room = await markingRoom(['MARK'])
    await bite(room, FIRST_TARGET_ID, 1)
    await untilAttackerTurn(room)

    await bite(room, SECOND_TARGET_ID, 2)
    expect(await marks(room)).toEqual([SECOND_TARGET_ID])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await marks(room)).toEqual([FIRST_TARGET_ID])
  }, 120000)

  it('marks nothing while Marking is off', async () => {
    const room = await markingRoom([])
    await bite(room, FIRST_TARGET_ID, 1)
    expect(await marks(room)).toEqual([])
  }, 120000)
})
