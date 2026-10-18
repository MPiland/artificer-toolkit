import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { crusher } from '@artificer-toolkit/rules-runtime/testing/crusher'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * ATTACK-7.T5 (AC 7.7, D157): a homebrew Crusher feat moves the creature a bludgeoning hit lands on
 * 5 feet in any direction. The hit holds for the attacker to pick one of the legal free squares the
 * room derives on its Scene; the answer moves the creature in the action's commit, as a FORCED move
 * only the action's undo reverts. A token is 100 px, a cell 5 ft.
 */

const FIGHTER_ACTOR_ID = testUuid(0xb20)
const FIGHTER_ID = testUuid(0xb21)
const WOLF_ID = testUuid(0xb22)
const FIGHTER_AT: ScenePoint = { x: 250, y: 250 }
const WOLF_AT: ScenePoint = { x: 350, y: 250 }

const BLUDGEONING_ID = SRD_DAMAGE_TYPES.find(({ code }) => code === 'BLUDGEONING')!.id
/** Zero-based d20 face of a hit that is not a critical; every other die shows 1. */
const HIT_FACE = 18
const LOWEST_FACE = 0

/** Every free square 5 feet from the Wolf: the eight around it but the Fighter's. */
const WOLF_DESTINATIONS: ScenePoint[] = [250, 350, 450]
  .flatMap((x) => [150, 250, 350].map((y) => ({ x, y })))
  .filter(
    ({ x, y }) =>
      !(x === WOLF_AT.x && y === WOLF_AT.y) && !(x === FIGHTER_AT.x && y === FIGHTER_AT.y)
  )

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
const byPosition = (left: ScenePoint, right: ScenePoint) => left.x - right.x || left.y - right.y

/** A player's Fighter with a Club and the Crusher feat, beside a Wolf; its attacks hit. */
function crusherRoom() {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [HIT_FACE, LOWEST_FACE, HIT_FACE],
    fallbackRoll: LOWEST_FACE,
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    positions: { [FIGHTER_ACTOR_ID]: FIGHTER_AT, [WOLF_ID]: WOLF_AT },
    playerControlledActorIds: [FIGHTER_ACTOR_ID],
    characterPlay: { equipped: true },
    characterClassFeatures: [crusher(BLUDGEONING_ID)],
    characterAction: (action) => action.label.includes('Club')
  })
}
type Room = Awaited<ReturnType<typeof crusherRoom>>

/** The Club hits the Wolf; the room holds the hit for the Wolf's destination. */
async function clubToTheDestination(room: Room) {
  // The acting creature's own action reads no Scene context (D11).
  committed((await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])).answer)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'FORCED_MOVEMENT_DESTINATION')
    throw new Error(`Expected the destination pick, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

describe('a Crusher hit moves its target to the square its attacker picks (AC 7.7)', () => {
  it('holds the hit for the attacker’s pick among the free squares 5 feet away, moving nothing', async () => {
    const room = await crusherRoom()
    const { pending } = await clubToTheDestination(room)

    expect(pending.sourceActorId).toBe(FIGHTER_ACTOR_ID)
    expect(pending.targetActorId).toBe(WOLF_ID)
    expect(pending.allowedResponses).toEqual(['FORCED_MOVEMENT'])
    expect([...pending.positions].sort(byPosition)).toEqual(WOLF_DESTINATIONS.sort(byPosition))
    expect(tokenPositions(room)(WOLF_ID)).toEqual(WOLF_AT)
    const { receipts } = await readRoomHistory(room.room.base.stub)
    expect(receipts.filter(({ commandType }) => commandType === 'RESOLVE_ACTION')).toEqual([])
  })

  it('moves the Wolf to the square the Fighter’s player picks, as a move only the action’s undo reverts', async () => {
    const room = await crusherRoom()
    const { decision, pending } = await clubToTheDestination(room)
    const position = { x: 450, y: 350 }

    committed(
      await room.sendAsPlayer(
        room.resolveCommand(decision, {
          kind: 'FORCED_MOVEMENT',
          requestId: pending.requestId,
          position
        })
      )
    )
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(tokenPositions(room)(WOLF_ID)).toEqual(position)
    expect(tokenPositions(room)(FIGHTER_ACTOR_ID)).toEqual(FIGHTER_AT)

    committed(
      await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
    )
    expect(tokenPositions(room)(WOLF_ID)).toEqual(WOLF_AT)
  })

  it('refuses a square it did not offer and keeps the pick open', async () => {
    const room = await crusherRoom()
    const { decision, pending } = await clubToTheDestination(room)

    for (const position of [FIGHTER_AT, { x: 550, y: 250 }, WOLF_AT])
      expect(
        await room.resolve(decision, {
          kind: 'FORCED_MOVEMENT',
          requestId: pending.requestId,
          position
        })
      ).toMatchObject({ type: 'COMMAND_REJECTED' })
    expect((await room.pendingDecision()).pending.kind).toBe('FORCED_MOVEMENT_DESTINATION')
    expect(tokenPositions(room)(WOLF_ID)).toEqual(WOLF_AT)
  })

  it('moves the Wolf only once a turn: a second Club hit settles without a pick', async () => {
    const room = await crusherRoom()
    const { decision, pending } = await clubToTheDestination(room)
    const position = { x: 350, y: 350 }
    committed(
      await room.resolve(decision, {
        kind: 'FORCED_MOVEMENT',
        requestId: pending.requestId,
        position
      })
    )

    committed(
      (await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED', 'ACTION_ECONOMY_UNAVAILABLE']))
        .answer
    )
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(tokenPositions(room)(WOLF_ID)).toEqual(position)
  })
})
