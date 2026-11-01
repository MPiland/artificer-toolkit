import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5rb: a Monk's melee hit holds for the choice to pay ki for Stunning Strike, an optional
 * on-hit rider authored from core options. Paying spends the ki, the target's Constitution save is
 * called against the Monk's derived DC, and a failure leaves it stunned; undo returns both.
 */

const MONK_ACTOR_ID = testUuid(0xb20)
const MONK_ID = testUuid(0xb21)
const WOLF_ID = testUuid(0xb22)

/** Zero-based d20 faces: the attack hits; every later die, the wolf's save included, shows 1. */
const HIT_FACE = 18
const LOWEST_FACE = 0

/** The SRD Monk's Stunning Strike, reached at the level 5 Monk this room's Character is. */
const stunningStrike = (() => {
  const feature = monk.features?.find(({ label }) => label === 'Stunning Strike')
  if (!feature) throw new Error('The SRD Stunning Strike is missing.')
  return feature
})()

const stunnedId = srdSystemRecord.conditionTypes.find(({ code }) => code === 'STUNNED')!.id

afterEach(() => {
  closeTrackedSockets()
})

const monkRoom = () =>
  actionRoom({
    autoRoll: 'BOTH',
    rolls: [HIT_FACE],
    fallbackRoll: LOWEST_FACE,
    actors: [
      characterActor({ id: MONK_ACTOR_ID, characterId: MONK_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterClassFeatures: [stunningStrike],
    characterPlay: { equipped: true, characterClass: monk, classLevel: 5 },
    characterAction: (action) => action.label.includes('Club')
  })
type Room = Awaited<ReturnType<typeof monkRoom>>

/** Starts the Club attack; the room pauses at the hit for the Monk's on-hit choice. */
async function strikeToTheOffer(room: Room) {
  const { answer } = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'ON_HIT_CHOICE')
    throw new Error(`Expected the on-hit choice, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

/** The ki the Monk has spent, as the Sheet's play state records resource uses. */
const readUsed = (room: Room) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === MONK_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return (readCharacterPlay(row).resourceUsage ?? []).map(({ used }) => used)
  })

const conditionsOnWolf = async (room: Room) =>
  (
    (vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WOLF_ID)
      ?.conditions ?? []) as { conditionTypeId: string }[]
  ).map(({ conditionTypeId }) => conditionTypeId)

describe('room Stunning Strike, an optional on-hit rider paid with ki (SPELLS-31.T5rb)', () => {
  it('names the rider and its ki cost, then stuns a target that fails the save and undoes with the hit', async () => {
    const room = await monkRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { decision, pending } = await strikeToTheOffer(room)

    expect(pending.options).toMatchObject([
      { kind: 'RESOURCE_POOL', riderLabel: 'Stunning Strike', cost: 1 }
    ])
    expect(await conditionsOnWolf(room)).not.toContain(stunnedId)

    const used = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: pending.options[0]!.optionId
    })
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await conditionsOnWolf(room)).toContain(stunnedId)
    expect(await readUsed(room)).toEqual([1])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await conditionsOnWolf(room)).not.toContain(stunnedId)
    expect((await readRoomHistory(room.room.base.stub)).actors).toEqual(before.actors)
  })

  it('stuns nothing and spends no ki when declined', async () => {
    const room = await monkRoom()
    const { decision } = await strikeToTheOffer(room)

    const declined = await room.resolve(decision, { kind: 'DECLINE' })
    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await conditionsOnWolf(room)).not.toContain(stunnedId)
    expect(await readUsed(room)).toEqual([])
  })
})
