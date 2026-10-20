import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf, reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, directedAreaWolf, forceOnFailedSave } from './actionRoomFixture.js'
import { answerAllSaves, tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * ATTACK-7.T5a (D139): an action's push or pull settles on the Scene in its own commit, straight
 * from the acting creature, stopping before the first blocked square, as a FORCED move that
 * provokes nothing; only the action's undo puts the creatures back. A token is 100 px, a cell 5 ft.
 */

const SOURCE_ID = testUuid(0xb00)
const NEAR_ID = testUuid(0xb01)
const FAR_ID = testUuid(0xb02)
const BLOCKER_ID = testUuid(0xb03)
const WATCHER_ID = testUuid(0xb04)
const SOURCE_AT: ScenePoint = { x: 150, y: 150 }
const NEAR_AT: ScenePoint = { x: 250, y: 150 }
const FAR_AT: ScenePoint = { x: 350, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

/** A Wolf whose Bite's failed save pushes its one target `feet` away, at any range. */
function pushRoom(
  others: { id: string; at: ScenePoint; creature?: typeof plainWolf }[],
  {
    feet = 10,
    direction = 'AWAY_FROM_SOURCE',
    distanceMode = 'EXACT',
    reachFeet,
    rolls = []
  }: {
    feet?: number
    distanceMode?: 'EXACT' | 'UP_TO'
    /** The Bite's reach, which an aside move stays within; omitted, it has any range. */
    reachFeet?: number
    direction?: Parameters<typeof forceOnFailedSave>[1]
    /** The zero-based results the platform's random source serves before it falls back to real ones. */
    rolls?: number[]
  } = {}
) {
  const creature = forceOnFailedSave(biteWolf('SAVE', { reachFeet }), direction, feet, distanceMode)
  return actionRoom({
    rolls,
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      ...others.map(({ id, creature: other = plainWolf }) =>
        srdCreatureActor({ id, creature: other })
      )
    ],
    positions: {
      [SOURCE_ID]: SOURCE_AT,
      ...Object.fromEntries(others.map(({ id, at }) => [id, at]))
    },
    ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id
  })
}
type Room = Awaited<ReturnType<typeof pushRoom>>

/** The Wolf bites `targetActorId`, whose save is answered with `face`. */
async function bite(room: Room, targetActorId: string, face: number) {
  const { answer } = await room.startAction(targetActorId, ['TARGET_RANGE_UNCHECKED'])
  committed(answer)
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
  const { request } = decision.pending
  committed(
    await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: request.rollMode === 'NORMAL' ? [face] : [face, face],
      rollMode: request.rollMode
    })
  )
  expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
}

function undoSceneMove(room: Room, expectedSceneVersion = room.room.scene.version + 1) {
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'SCENE',
    command: {
      type: 'UNDO_LAST_SCENE_MOVE',
      commandId,
      expectedSceneVersion,
      sceneId: room.room.scene.id
    }
  })
}

async function revertLastAction(room: Room) {
  return room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
}

describe('an action’s forced movement in the room (ATTACK-7.T5a)', () => {
  it('pushes a single target that fails its save straight away by the authored distance, and not one that succeeds', async () => {
    const failed = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }])
    await bite(failed, NEAR_ID, 1)
    expect(tokenPositions(failed)(NEAR_ID)).toEqual({ x: 450, y: 150 })
    expect(tokenPositions(failed)(SOURCE_ID)).toEqual(SOURCE_AT)

    const saved = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }])
    await bite(saved, NEAR_ID, 20)
    expect(tokenPositions(saved)(NEAR_ID)).toEqual(NEAR_AT)
  })

  it('pulls a single target toward the source and stops beside it', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: { x: 650, y: 150 } }], {
      feet: 40,
      direction: 'TOWARD_SOURCE'
    })
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
  })

  it('pushes every creature an area catches, the farthest first so a nearer one is not blocked by it', async () => {
    const creature = forceOnFailedSave(
      directedAreaWolf({
        shapeKind: 'LINE',
        length: { amount: 15, unit: 'FEET' },
        width: { amount: 5, unit: 'FEET' }
      }),
      'AWAY_FROM_SOURCE',
      10
    )
    const room = await actionRoom({
      rolls: [],
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature }),
        srdCreatureActor({ id: NEAR_ID, creature: plainWolf }),
        srdCreatureActor({ id: FAR_ID, creature: plainWolf })
      ],
      positions: { [SOURCE_ID]: SOURCE_AT, [NEAR_ID]: NEAR_AT, [FAR_ID]: FAR_AT },
      ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id
    })
    committed((await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })).answer)
    await answerAllSaves(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(tokenPositions(room)(FAR_ID)).toEqual({ x: 550, y: 150 })
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 150 })
  })

  it('stops a pushed creature in the last free square before another creature’s token', async () => {
    const room = await pushRoom(
      [
        { id: NEAR_ID, at: NEAR_AT },
        { id: BLOCKER_ID, at: { x: 450, y: 150 } }
      ],
      { feet: 20 }
    )
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(FAR_AT)
    expect(tokenPositions(room)(BLOCKER_ID)).toEqual({ x: 450, y: 150 })
  })

  it('provokes no opportunity attack when the push carries the target out of a watcher’s reach', async () => {
    const room = await pushRoom([
      { id: NEAR_ID, at: NEAR_AT },
      { id: WATCHER_ID, at: { x: 250, y: 250 }, creature: reactionWolf }
    ])
    const before = await readRoomHistory(room.room.base.stub)
    await bite(room, NEAR_ID, 1)

    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 150 })
    expect(await room.room.pending()).toBeNull()
    const after = await readRoomHistory(room.room.base.stub)
    expect(
      after.commands.slice(before.commands.length).map(({ commandType }) => commandType)
    ).toEqual(['RESOLVE_ACTION'])
  })

  it('puts the pushed creature back on the GM’s undo of the action, which the Scene’s own move undo refuses', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }])
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 150 })

    expect(await undoSceneMove(room)).toMatchObject({
      type: 'COMMAND_REJECTED',
      code: 'INVALID_COMMAND',
      message: 'This move was part of an Encounter action; undo the action instead.'
    })
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 150 })

    committed(await revertLastAction(room))
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
  })

  it('refuses the action’s undo once the GM moved the pushed creature again, even after that move is undone', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }])
    await bite(room, NEAR_ID, 1)
    committed(
      await room.room.teleport(
        [
          { x: 450, y: 150 },
          { x: 450, y: 250 }
        ],
        await room.version(),
        room.room.scene.version + 1,
        `f${NEAR_ID.slice(1)}`
      )
    )

    expect(await revertLastAction(room)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE'
    })
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 250 })

    expect(await undoSceneMove(room, room.room.scene.version + 2)).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVE_UNDONE', position: { x: 450, y: 150 } } } }
    })
    expect(await revertLastAction(room)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE'
    })
  })
})

/** The compass ray each draw picks: N, NE, E, SE, S, SW, W, NW are 0 to 7. */
const NORTH = 0
const EAST = 2
const SOUTH = 4
const WEST = 6

/** The landing report the room's last committed action recorded. */
async function recordedLandings(room: Room) {
  const { commands } = await readRoomHistory(room.room.base.stub)
  const resolved = commands.flatMap((command) =>
    command.commandType === 'RESOLVE_ACTION' ? [command] : []
  )
  return resolved.at(-1)?.forcedMovementLandings
}

describe('a forced movement the mover picks, in the room (AC 7.7)', () => {
  /** The Wolf bites and its target fails the save; the room holds the move for the pick. */
  async function pickedBite(room: Room) {
    const { answer } = await room.startAction(NEAR_ID, ['TARGET_RANGE_UNCHECKED'])
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
    const picked = await room.pendingDecision()
    if (picked.pending.kind !== 'FORCED_MOVEMENT_DESTINATION')
      throw new Error(`Expected the destination pick, got ${picked.pending.kind}.`)
    return { decision: picked, pending: picked.pending }
  }
  const byPosition = (left: ScenePoint, right: ScenePoint) => left.x - right.x || left.y - right.y

  it('lets the mover pick how far along the straight line an up-to push goes, from none to the most', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      feet: 15,
      distanceMode: 'UP_TO'
    })
    const { decision, pending } = await pickedBite(room)

    expect([...pending.positions].sort(byPosition)).toEqual([
      NEAR_AT,
      { x: 350, y: 150 },
      { x: 450, y: 150 },
      { x: 550, y: 150 }
    ])
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)

    committed(
      await room.resolve(decision, {
        kind: 'FORCED_MOVEMENT',
        requestId: pending.requestId,
        position: { x: 450, y: 150 }
      })
    )
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 150 })
  })

  it('offers an aside move only the squares within the source’s reach, and a watcher gets no opportunity attack on the pick', async () => {
    const room = await pushRoom(
      [
        { id: NEAR_ID, at: NEAR_AT },
        { id: WATCHER_ID, at: { x: 350, y: 250 }, creature: reactionWolf }
      ],
      { feet: 5, direction: 'ASIDE', reachFeet: 5 }
    )
    const { decision, pending } = await pickedBite(room)

    // The Wolf at x 150 reaches 5 feet; the squares 5 feet from the target inside that reach flank it.
    expect([...pending.positions].sort(byPosition)).toEqual([
      { x: 150, y: 50 },
      { x: 150, y: 250 },
      { x: 250, y: 50 },
      { x: 250, y: 250 }
    ])

    committed(
      await room.resolve(decision, {
        kind: 'FORCED_MOVEMENT',
        requestId: pending.requestId,
        position: { x: 250, y: 50 }
      })
    )
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 250, y: 50 })
    // The watcher at (350, 250) touches the target's square and not the one it was moved to.
    expect(await room.room.pending()).toBeNull()
  })
})

describe('a random forced movement in the room (SPELLS-33.T6k2a, D159)', () => {
  it('rolls its direction once, moves the target along it and records the ray in the commit', async () => {
    // A second draw would serve WEST: the target moves east only if the direction was rolled once.
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      direction: 'RANDOM',
      rolls: [EAST, WEST, WEST]
    })
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 150 })
    expect(await recordedLandings(room)).toEqual([
      { targetActorId: NEAR_ID, feet: 10, stoppedBy: 'NONE', ray: { x: 1, y: 0 } }
    ])
  })

  it('moves along whichever compass ray the draw picks', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      direction: 'RANDOM',
      rolls: [SOUTH]
    })
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 250, y: 350 })
    expect(await recordedLandings(room)).toEqual([
      { targetActorId: NEAR_ID, feet: 10, stoppedBy: 'NONE', ray: { x: 0, y: 1 } }
    ])
  })

  it('stops in the last free square before a creature and names it', async () => {
    const room = await pushRoom(
      [
        { id: NEAR_ID, at: NEAR_AT },
        { id: BLOCKER_ID, at: { x: 450, y: 150 } }
      ],
      { direction: 'RANDOM', feet: 20, rolls: [EAST] }
    )
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(FAR_AT)
    expect(await recordedLandings(room)).toEqual([
      { targetActorId: NEAR_ID, feet: 5, stoppedBy: BLOCKER_ID, ray: { x: 1, y: 0 } }
    ])
  })

  it('stops at the map edge and reports an object', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      direction: 'RANDOM',
      feet: 20,
      rolls: [NORTH]
    })
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 250, y: 50 })
    expect(await recordedLandings(room)).toEqual([
      { targetActorId: NEAR_ID, feet: 5, stoppedBy: 'OBJECT', ray: { x: 0, y: -1 } }
    ])
  })

  it('stays put against the acting creature itself, travelling no feet', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      direction: 'RANDOM',
      rolls: [WEST]
    })
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
    expect(await recordedLandings(room)).toEqual([
      { targetActorId: NEAR_ID, feet: 0, stoppedBy: SOURCE_ID, ray: { x: -1, y: 0 } }
    ])
  })

  it('reports a straight push that nothing stopped with no ray', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }])
    await bite(room, NEAR_ID, 1)
    expect(await recordedLandings(room)).toEqual([
      { targetActorId: NEAR_ID, feet: 10, stoppedBy: 'NONE', ray: null }
    ])
  })

  it('lands several creatures the farthest first, each against the Scene after the earlier landings', async () => {
    const creature = forceOnFailedSave(
      directedAreaWolf({
        shapeKind: 'LINE',
        length: { amount: 15, unit: 'FEET' },
        width: { amount: 5, unit: 'FEET' }
      }),
      'RANDOM',
      20
    )
    const room = await actionRoom({
      rolls: [],
      fallbackRoll: EAST,
      actors: [
        srdCreatureActor({ id: SOURCE_ID, creature }),
        srdCreatureActor({ id: NEAR_ID, creature: plainWolf }),
        srdCreatureActor({ id: FAR_ID, creature: plainWolf })
      ],
      positions: { [SOURCE_ID]: SOURCE_AT, [NEAR_ID]: NEAR_AT, [FAR_ID]: FAR_AT },
      ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id
    })
    committed((await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })).answer)
    await answerAllSaves(room)

    // Nearest first would leave the near creature stopped by the far one's old square.
    expect(tokenPositions(room)(FAR_ID)).toEqual({ x: 750, y: 150 })
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 650, y: 150 })
    const east = { x: 1, y: 0 }
    expect(await recordedLandings(room)).toEqual([
      { targetActorId: FAR_ID, feet: 20, stoppedBy: 'NONE', ray: east },
      { targetActorId: NEAR_ID, feet: 20, stoppedBy: 'NONE', ray: east }
    ])
  })

  it('answers a replayed command from the record without moving the target or drawing again', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      direction: 'RANDOM',
      rolls: [EAST, WEST, WEST]
    })
    committed((await room.startAction(NEAR_ID, ['TARGET_RANGE_UNCHECKED'])).answer)
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the save prompt.')
    const { request } = decision.pending
    const command = room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: request.rollMode === 'NORMAL' ? [1] : [1, 1],
      rollMode: request.rollMode
    })
    committed(await room.send(command))
    const landings = await recordedLandings(room)
    const commandCount = (await readRoomHistory(room.room.base.stub)).commands.length

    committed(await room.send(command))
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 150 })
    expect(await recordedLandings(room)).toEqual(landings)
    expect((await readRoomHistory(room.room.base.stub)).commands).toHaveLength(commandCount)
  })

  it('puts a randomly moved creature back on the undo of the action', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      direction: 'RANDOM',
      rolls: [SOUTH]
    })
    await bite(room, NEAR_ID, 1)
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 250, y: 350 })

    committed(await revertLastAction(room))
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
  })

  it('refuses the undo once the GM moved the creature again', async () => {
    const room = await pushRoom([{ id: NEAR_ID, at: NEAR_AT }], {
      direction: 'RANDOM',
      rolls: [SOUTH]
    })
    await bite(room, NEAR_ID, 1)
    committed(
      await room.room.teleport(
        [
          { x: 250, y: 350 },
          { x: 450, y: 350 }
        ],
        await room.version(),
        room.room.scene.version + 1,
        `f${NEAR_ID.slice(1)}`
      )
    )
    expect(await revertLastAction(room)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'REVERT_UNAVAILABLE'
    })
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 450, y: 350 })
  })
})
