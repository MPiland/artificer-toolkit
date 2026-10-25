import { runInDurableObject } from 'cloudflare:test'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  DND5E_FLANKING_DEFINITION_ID,
  DND5E_FLANKING_OPERATION_KEY
} from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * ATTACK-12.T1: with the Facing rule on, a voluntary move may end in a facing, and a creature may
 * turn as a reaction. Turning is never movement, the Scene undo of a move turns the token back, and
 * the action undo of a reaction turns it back and returns the reaction. The SRD Facing rule allows
 * 90-degree steps.
 */

const MOVER_ID = testUuid(0xa12)
const WATCHER_ID = testUuid(0xa13)
const ALLY_ID = testUuid(0xa14)
const MOVER_START: ScenePoint = { x: 150, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function facingRoom(facing = true) {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: MOVER_ID, creature: plainWolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: WATCHER_ID, creature: plainWolf })
    ],
    moverActorId: MOVER_ID,
    positions: { [MOVER_ID]: MOVER_START, [WATCHER_ID]: { x: 650, y: 150 } },
    optionalCombatKinds: facing ? ['FACING'] : []
  })
}

type Room = Awaited<ReturnType<typeof facingRoom>>

const tokenIdOf = (actorId: string) => `f${actorId.slice(1)}`

function encounterVersion(room: Room) {
  return runInDurableObject(room.base.stub, async (_instance, context) => {
    const [run] = new RoomEncounterStore(context.storage).documents('encounterRuns')
    if (!run) throw new Error('The room holds no Run.')
    return run.version
  })
}

function feetMoved(room: Room) {
  return runInDurableObject(room.base.stub, async (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('encounterTurnMovements')
      .reduce((total, { usedFeet }) => total + usedFeet, 0)
  )
}

/** The facing of an actor's token in the Scene the room last synced to the GM. */
function facingOf(room: Room, actorId: string) {
  const sync = [...room.base.messages].reverse().find((message) => message.type === 'STATE_SYNC')
  if (sync?.type !== 'STATE_SYNC' || !sync.state.scene)
    throw new Error('The room has sent the GM no Scene.')
  return sync.state.scene.tokens.find(({ id }) => id === tokenIdOf(actorId))?.rotationDegrees
}

function moveFacing(room: Room, path: readonly ScenePoint[], facingDegrees: number) {
  const commandId = crypto.randomUUID()
  return room.send(commandId, {
    scope: 'SCENE',
    command: {
      type: 'MOVE_SCENE_TOKEN',
      commandId,
      correlationId: null,
      expectedEncounterVersion: room.encounterVersion,
      expectedSceneVersion: room.scene.version,
      movementKind: 'VOLUNTARY',
      path,
      sceneId: room.scene.id,
      tokenId: room.moverTokenId,
      facingDegrees
    }
  })
}

async function encounterCommand(room: Room, command: Record<string, unknown>) {
  const commandId = crypto.randomUUID()
  return room.send(commandId, {
    scope: 'ENCOUNTER',
    command: {
      ...command,
      encounterId: room.encounterId,
      commandId,
      expectedVersion: await encounterVersion(room)
    }
  })
}

const changeFacing = (room: Room, rotationDegrees: number) =>
  encounterCommand(room, {
    type: 'CHANGE_FACING',
    actorId: WATCHER_ID,
    rotationDegrees,
    acknowledgedWarnings: []
  })

describe('Facing (ATTACK-12.T1)', () => {
  it('ends a move in the chosen facing without spending movement on the turn, and the Scene undo turns it back', async () => {
    const room = await facingRoom()

    const moved = await moveFacing(room, [MOVER_START, { x: 250, y: 150 }], 90)

    expect(moved).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVED', rotationDegrees: 90 } } }
    })
    // One 5-ft square walked; the turn costs nothing more.
    expect(await feetMoved(room)).toBe(5)

    const commandId = crypto.randomUUID()
    const undone = await room.send(commandId, {
      scope: 'SCENE',
      command: {
        type: 'UNDO_LAST_SCENE_MOVE',
        commandId,
        expectedSceneVersion: room.scene.version + 1,
        sceneId: room.scene.id
      }
    })
    expect(undone).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: {
        result: {
          delta: { kind: 'TOKEN_MOVE_UNDONE', position: MOVER_START, rotationDegrees: 0 }
        }
      }
    })
  })

  it('turns a creature as a reaction without moving it, and the action undo turns it back and returns the reaction', async () => {
    const room = await facingRoom()

    const turned = await changeFacing(room, 180)
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')
    expect(facingOf(room, WATCHER_ID)).toBe(180)
    expect(await feetMoved(room)).toBe(0)

    // Its reaction is spent, so a second turn this round needs the GM's override.
    const again = await changeFacing(room, 90)
    expect(again.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(again)).toContain('RULE_WARNINGS')
    expect(facingOf(room, WATCHER_ID)).toBe(180)

    const reverted = await encounterCommand(room, { type: 'REVERT_LAST_ACTION' })
    expect(reverted.type, JSON.stringify(reverted)).toBe('COMMAND_COMMITTED')
    expect(facingOf(room, WATCHER_ID)).toBe(0)
    expect((await changeFacing(room, 90)).type).toBe('COMMAND_COMMITTED')
    expect(facingOf(room, WATCHER_ID)).toBe(90)
  })

  it('refuses a facing between the rule’s steps, and any facing when the rule is off', async () => {
    const on = await facingRoom()
    for (const refused of [
      await moveFacing(on, [MOVER_START, { x: 250, y: 150 }], 45),
      await changeFacing(on, 45)
    ]) {
      expect(refused.type).toBe('COMMAND_REJECTED')
      expect(JSON.stringify(refused)).toContain('FACING_UNAVAILABLE')
    }
    expect(facingOf(on, MOVER_ID)).toBe(0)

    const off = await facingRoom(false)
    for (const refused of [
      await moveFacing(off, [MOVER_START, { x: 250, y: 150 }], 90),
      await changeFacing(off, 90)
    ]) {
      expect(refused.type).toBe('COMMAND_REJECTED')
      expect(JSON.stringify(refused)).toContain('FACING_UNAVAILABLE')
    }
    expect(await feetMoved(off)).toBe(0)
  })
})

/** The Watcher bites the Mover; both face north, the Watcher standing at `attackerAt`. */
async function biteRoom(attackerAt: ScenePoint, facing = true) {
  const wolf = biteWolf('ATTACK')
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: Array.from({ length: 8 }, () => 14),
    actors: [
      srdCreatureActor({ id: WATCHER_ID, creature: wolf }),
      srdCreatureActor({ id: MOVER_ID, creature: wolf, disposition: 'FRIENDLY' })
    ],
    positions: { [WATCHER_ID]: attackerAt, [MOVER_ID]: MOVER_START },
    optionalCombatKinds: facing ? ['FACING'] : [],
    ownerFeatureId: creatureFeature(wolf, 'Bite').id
  })
}

/** The Bite's settled attack d20, as its receipt records it. */
async function biteD20(room: Awaited<ReturnType<typeof biteRoom>>, commandId: string) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find(
    (candidate) => candidate.commandId === commandId && candidate.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The Bite left no receipt.')
  const execution = parseReceiptExecution(receipt)
  if (
    execution.status !== 'COMPLETE' ||
    execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ||
    !execution.applicationOutputs.d20
  )
    throw new Error('Expected a settled Bite attack.')
  return execution.applicationOutputs.d20
}

describe('attacks with Facing (ATTACK-12.T2)', () => {
  const behindMover = { x: MOVER_START.x, y: MOVER_START.y + 100 }
  const aheadOfMover = { x: MOVER_START.x, y: MOVER_START.y - 100 }

  const rearArc = {
    sourceId: 'rule:facing',
    grantId: null,
    domainKey: 'rule:facing',
    influence: 'ADVANTAGE',
    source: { kind: 'RULE', id: 'facing', holderActorId: null },
    positional: { arc: 'REAR' }
  }

  it('rolls an attack from the target’s rear arc with advantage, and the receipt names the arc', async () => {
    const room = await biteRoom(behindMover)
    const { command, answer } = await room.startAction(MOVER_ID, [], room.sceneContext(1))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const d20 = await biteD20(room, command.commandId)
    expect(d20.rollMode).toBe('ADVANTAGE')
    expect(d20.contributors).toEqual([rearArc])
  })

  it('gives no advantage from the front, or with the rule off', async () => {
    for (const room of [await biteRoom(aheadOfMover), await biteRoom(behindMover, false)]) {
      // From ahead the target stands behind the attacker, which the GM overrides here.
      const { command, answer } = await room.startAction(
        MOVER_ID,
        ['TARGET_FACING_ARC'],
        room.sceneContext(1)
      )
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const d20 = await biteD20(room, command.commandId)
      expect(d20.rollMode).toBe('NORMAL')
      expect(d20.contributors).toEqual([])
    }
  })

  it('refuses a target in the attacker’s own rear arc until the GM overrides it', async () => {
    const room = await biteRoom(aheadOfMover)
    const before = await room.version()
    const { answer } = await room.startAction(MOVER_ID, [], room.sceneContext(1))
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(answer)).toContain('TARGET_FACING_ARC')
    expect(await room.version()).toBe(before)
  })
})

/** The Watcher bites the Mover from the south while an allied wolf stands at `allyAt`. */
async function flankingRoom(allyAt: ScenePoint) {
  const wolf = biteWolf('ATTACK')
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: Array.from({ length: 8 }, () => 14),
    actors: [
      srdCreatureActor({ id: WATCHER_ID, creature: wolf }),
      srdCreatureActor({ id: MOVER_ID, creature: wolf, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: ALLY_ID, creature: wolf })
    ],
    positions: {
      [WATCHER_ID]: { x: MOVER_START.x, y: MOVER_START.y + 100 },
      [MOVER_ID]: MOVER_START,
      [ALLY_ID]: allyAt
    },
    optionalCombatKinds: ['FLANKING'],
    ownerFeatureId: creatureFeature(wolf, 'Bite').id
  })
}

describe('attacks with Flanking (ATTACK-12.T2f)', () => {
  it('rolls a melee attack with advantage when an ally stands opposite the attacker', async () => {
    const room = await flankingRoom({ x: MOVER_START.x, y: MOVER_START.y - 100 })
    const { command, answer } = await room.startAction(MOVER_ID, [], room.sceneContext(1))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const d20 = await biteD20(room, command.commandId)
    expect(d20.rollMode).toBe('ADVANTAGE')
    expect(d20.contributors).toEqual([
      {
        sourceId: DND5E_FLANKING_DEFINITION_ID,
        grantId: null,
        domainKey: DND5E_FLANKING_OPERATION_KEY,
        influence: 'ADVANTAGE',
        source: { kind: 'AUTHORED', id: DND5E_FLANKING_DEFINITION_ID, holderActorId: null }
      }
    ])
  })

  it('gives no advantage when the adjacent ally is not opposite the attacker', async () => {
    const room = await flankingRoom({ x: MOVER_START.x + 100, y: MOVER_START.y })
    const { command, answer } = await room.startAction(MOVER_ID, [], room.sceneContext(1))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const d20 = await biteD20(room, command.commandId)
    expect(d20.rollMode).toBe('NORMAL')
    expect(d20.contributors).toEqual([])
  })
})
