import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, spatialDamageEffect } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, forceOnFailedSave } from './actionRoomFixture.js'
import { tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, revertLastAction } from './placedZoneRoomReads.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T1j (D170): a push or pull settles the zone contacts along its path in the action's own
 * commit, through the same spatial candidate execution voluntary movement uses. A token is 100 px,
 * a cell 5 ft.
 */

const SOURCE_ID = testUuid(0xc00)
const TARGET_ID = testUuid(0xc01)
const SOURCE_AT: ScenePoint = { x: 150, y: 150 }
const TARGET_AT: ScenePoint = { x: 250, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

/** A Wolf whose Bite's failed save pushes its one target `feet` away; each die shows its lowest face. */
function zoneRoom(
  zone: { center: ScenePoint; radius: number; save?: boolean },
  {
    feet = 10,
    targetHitPoints,
    activation = 'REPEATABLE'
  }: { feet?: number; targetHitPoints?: number; activation?: 'ONE_SHOT' | 'REPEATABLE' } = {}
) {
  const creature = forceOnFailedSave(biteWolf('SAVE'), 'AWAY_FROM_SOURCE', feet)
  return actionRoom({
    rolls: [],
    fallbackRoll: 0,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      srdCreatureActor({
        id: TARGET_ID,
        creature: plainWolf,
        currentHitPoints: targetHitPoints
      })
    ],
    positions: { [SOURCE_ID]: SOURCE_AT, [TARGET_ID]: TARGET_AT },
    ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id,
    seed: async ({ spatial, encounterId }) => {
      await spatial.create(
        await spatialDamageEffect({
          encounterId,
          targetActorId: TARGET_ID,
          movementKinds: ['VOLUNTARY', 'FORCED'],
          triggerModes: ['ENTER', 'CROSS'],
          activation,
          ...zone
        })
      )
    }
  })
}
type Room = Awaited<ReturnType<typeof zoneRoom>>

/** The Wolf bites the target, whose failed save the room answers with a 1. */
async function pushTarget(room: Room) {
  const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
  committed(answer)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
  const { request } = decision.pending
  committed(
    await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: request.rollMode
    })
  )
  expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
}

describe('an action’s forced movement through zones (SPELLS-4.T1j)', () => {
  it('settles the damage of a zone the pushed creature passes through', async () => {
    const room = await zoneRoom({ center: { x: 350, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)

    await pushTarget(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 450, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('settles the damage of a zone the pushed creature lands in', async () => {
    const room = await zoneRoom({ center: { x: 450, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)

    await pushTarget(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 450, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('settles a zone the move never touches as nothing', async () => {
    const room = await zoneRoom({ center: { x: 650, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)

    await pushTarget(room)

    expect(await hitPointsOf(room, TARGET_ID)).toBe(before)
  })

  it('stops the creature where a zone drops it to 0 hit points, and that cell is its landing', async () => {
    const room = await zoneRoom({ center: { x: 350, y: 150 }, radius: 20 }, { targetHitPoints: 1 })

    await pushTarget(room)

    expect(await hitPointsOf(room, TARGET_ID)).toBe(0)
    // The token's edge meets the zone 70 px short of its centre, where voluntary movement stops too.
    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 280, y: 150 })
    const { commands } = await readRoomHistory(room.room.base.stub)
    expect(
      commands.flatMap((command) =>
        command.commandType === 'RESOLVE_ACTION' ? (command.forcedMovementLandings ?? []) : []
      )
    ).toMatchObject([{ targetActorId: TARGET_ID, feet: 0 }])
  })

  it('rolls a save-or-damage zone with the room’s dice and records the outcome (homebrew zone)', async () => {
    const room = await zoneRoom({ center: { x: 350, y: 150 }, radius: 20, save: true })
    const before = await hitPointsOf(room, TARGET_ID)

    await pushTarget(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual({ x: 450, y: 150 })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('puts the creature, and the damage a zone dealt it, back on the undo of the action', async () => {
    const room = await zoneRoom({ center: { x: 350, y: 150 }, radius: 20 })
    const before = await hitPointsOf(room, TARGET_ID)
    await pushTarget(room)
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)

    await revertLastAction(room)

    expect(tokenPositions(room)(TARGET_ID)).toEqual(TARGET_AT)
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before)
  })

  it('refuses the undo when a spent one-shot zone cannot be put back', async () => {
    const room = await zoneRoom(
      { center: { x: 350, y: 150 }, radius: 20 },
      { activation: 'ONE_SHOT' }
    )
    const before = await hitPointsOf(room, TARGET_ID)
    await pushTarget(room)

    const refused = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })

    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'REVERT_UNAVAILABLE' })
    expect(await hitPointsOf(room, TARGET_ID)).toBe(before! - 1)
  })

  it('breaks the Concentration of a Character a zone hurts on the way, with the room’s own dice', async () => {
    const creature = forceOnFailedSave(biteWolf('SAVE'), 'AWAY_FROM_SOURCE', 10)
    const characterActorId = testUuid(0xc02)
    const room = await actionRoom({
      rolls: [],
      fallbackRoll: 0,
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature }),
        characterActor({ id: characterActorId, characterId: testUuid(0xc03) })
      ],
      positions: { [SOURCE_ID]: SOURCE_AT, [characterActorId]: TARGET_AT },
      ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id,
      concentration: true,
      concentrationOwnerActorId: characterActorId,
      seed: async ({ spatial, encounterId }) => {
        await spatial.create(
          await spatialDamageEffect({
            encounterId,
            targetActorId: characterActorId,
            center: { x: 350, y: 150 },
            radius: 20,
            movementKinds: ['VOLUNTARY', 'FORCED'],
            triggerModes: ['ENTER', 'CROSS'],
            activation: 'REPEATABLE'
          })
        )
      }
    })
    expect((await readRoomHistory(room.room.base.stub)).maintainedStates).toHaveLength(1)

    const { answer } = await room.startAction(characterActorId, ['TARGET_RANGE_UNCHECKED'])
    committed(answer)
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
    const { request } = decision.pending
    committed(
      await room.resolve(decision, {
        kind: 'ENTER_DICE',
        requestId: request.requestId,
        rawFaces: request.rollMode === 'NORMAL' ? [1] : [1, 1],
        rollMode: request.rollMode
      })
    )

    expect(tokenPositions(room)(characterActorId)).toEqual({ x: 450, y: 150 })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect((await readRoomHistory(room.room.base.stub)).maintainedStates).toEqual([])
  })
})
