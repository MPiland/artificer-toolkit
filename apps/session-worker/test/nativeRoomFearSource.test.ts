import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { fear } from '@artificer-toolkit/source-data/srd/spells/fear.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { frightenedId } from './areaConditionFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-29.T1 (AC 29.1): SRD Fear records its caster as the source of the Frightened it leaves.
 * A frightened creature has disadvantage on its attacks only while it sees the caster, a move that
 * ends closer to the caster warns and goes ahead when acknowledged, and the GM's undo reverts both
 * the move and the cast.
 */

const CASTER_ID = testUuid(0x8e0)
const CHARACTER_ID = testUuid(0x8e1)
const FRIGHTENED_WOLF_ID = testUuid(0x8e2)
const OTHER_WOLF_ID = testUuid(0x8e3)
const APPROACH: EncounterRuleWarningCodeDto = 'CONDITION_SOURCE_APPROACH'

/** The caster's token is at x = 150; the Wolves stand 15 and 20 feet east of it, inside the cone. */
const WOLF_START: ScenePoint = { x: 450, y: 150 }
const EAST = { origin: { x: 200, y: 150 }, toward: { x: 800, y: 150 } }

const invisible = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INVISIBLE')
if (!invisible) throw new Error('The SRD names the Invisible condition.')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const wolves = [FRIGHTENED_WOLF_ID, OTHER_WOLF_ID].map((id) =>
  srdCreatureActor({ id, creature: plainWolf })
)

/**
 * A Character who knows Fear, unseen by everyone when `casterInvisible`, and two Wolves. With
 * `rolls`, the GM's dice roll themselves: zero-based, so 0 is a natural 1.
 */
function fearRoom({
  casterInvisible = false,
  rolls
}: { casterInvisible?: boolean; rolls?: readonly number[] } = {}) {
  return actionRoom({
    ...(rolls && { autoRoll: 'GAME_MASTER' as const, rolls }),
    actors: [
      {
        ...characterActor({ id: CASTER_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      ...wolves
    ],
    positions: { [FRIGHTENED_WOLF_ID]: WOLF_START, [OTHER_WOLF_ID]: { x: 550, y: 150 } },
    characterSpellcasting: { spells: [fear], prepared: [fear.id] },
    characterPlay: {
      currentHitPoints: 10,
      ...(casterInvisible && {
        conditions: [{ conditionTypeId: invisible!.id, label: 'Invisible' }]
      })
    },
    characterAction: (action) => action.label === 'Fear (3rd level)',
    fallbackRoll: 5
  })
}

type FearRoom = Awaited<ReturnType<typeof fearRoom>>

/** The caster casts Fear east; every Wolf fails its Wisdom save with a 1. */
async function castFear(room: FearRoom) {
  const { answer } = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  for (;;) {
    const decision = await readPendingActionDecision(room.room.base.stub)
    if (decision?.pending.kind !== 'AREA_SAVES') break
    const [save] = decision.pending.saves
    if (!save) break
    const answered = await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [1],
        rollMode: save.request.rollMode
      })
    )
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
  }
  expect(await frightenedActorIds(room)).toEqual([FRIGHTENED_WOLF_ID, OTHER_WOLF_ID].sort())
}

async function frightenedActorIds(room: FearRoom) {
  return vitalsOf(await readRoomHistory(room.room.base.stub))
    .filter((vitals) =>
      ((vitals.conditions ?? []) as { conditionTypeId: string }[]).some(
        ({ conditionTypeId }) => conditionTypeId === frightenedId()
      )
    )
    .map(({ id }) => id)
    .sort()
}

/** The frightened Wolf's Bite at the other Wolf, on its own turn: the roll mode the room asks for. */
async function frightenedWolfBiteMode(room: FearRoom) {
  await room.advanceTurn()
  const bite = plainWolf.features?.find((feature) => feature.label === 'Bite')
  if (!bite) throw new Error('The Wolf has a Bite.')
  const { answer } = await room.startAction(
    OTHER_WOLF_ID,
    [],
    null,
    null,
    room.featureActionId(wolves[0]!, bite.id),
    FRIGHTENED_WOLF_ID
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (!('request' in decision.pending) || !('rollMode' in decision.pending.request)) {
    throw new Error('The Bite asks for its attack roll.')
  }
  return decision.pending.request.rollMode
}

/**
 * Ends the caster's turn, then the frightened Wolf's, and returns what Fear did at the end of the
 * Wolf's turn as the ADVANCE_TURN receipt journals it.
 */
async function endFrightenedWolfTurn(room: FearRoom) {
  await room.advanceTurn()
  await room.advanceTurn()
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.filter(({ commandType }) => commandType === 'ADVANCE_TURN').at(-1)
  if (!receipt) throw new Error('The Wolf’s turn end journals a receipt.')
  const result = parseReceiptExecution(receipt)
  if (result.status !== 'TURN_LIFECYCLE_COMPLETE' || result.outgoingTurn.kind !== 'EXECUTED')
    throw new Error(`Expected the Wolf’s END_OF_TURN effects, got ${JSON.stringify(result)}.`)
  return result.outgoingTurn.executions
}

/** The frightened Wolf's token moves along `path` on the GM's socket, acknowledging `acknowledged`. */
async function moveFrightenedWolf(
  room: FearRoom,
  path: readonly ScenePoint[],
  acknowledged: readonly EncounterRuleWarningCodeDto[] = [],
  movementKind: 'VOLUNTARY' | 'FORCED' | 'TELEPORT' = 'VOLUNTARY'
) {
  const token = room.room.scene.tokens[1]
  if (!token) throw new Error('The frightened Wolf has a token.')
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'SCENE',
    command: {
      type: 'MOVE_SCENE_TOKEN',
      commandId,
      correlationId: null,
      expectedEncounterVersion: await room.version(),
      expectedSceneVersion: room.room.scene.version,
      movementKind,
      path,
      sceneId: room.room.scene.id,
      tokenId: token.id,
      acknowledgedWarnings: [...acknowledged]
    }
  })
}

describe('room Fear follows its caster (SPELLS-29.T1)', () => {
  it('records the caster as the source of every Frightened it leaves', async () => {
    const room = await fearRoom()
    await castFear(room)
    const { activeEffects } = await readRoomHistory(room.room.base.stub)
    expect(activeEffects.map((effect) => effect.targetActorId).sort()).toEqual(
      [FRIGHTENED_WOLF_ID, OTHER_WOLF_ID].sort()
    )
    for (const effect of activeEffects)
      expect(JSON.parse(effect.definitionJson).stateContributions).toContainEqual({
        kind: 'CONDITION_OWNERSHIP',
        conditionId: frightenedId(),
        baselinePresent: false,
        sourceActorId: CASTER_ID
      })
  })

  it('gives the frightened Wolf disadvantage on its attack while it sees the caster', async () => {
    const room = await fearRoom()
    await castFear(room)
    expect(await frightenedWolfBiteMode(room)).toBe('DISADVANTAGE')
  })

  it('lifts the disadvantage while the caster is out of the Wolf’s sight', async () => {
    const room = await fearRoom({ casterInvisible: true })
    await castFear(room)
    expect(await frightenedWolfBiteMode(room)).toBe('NORMAL')
  })

  it('warns on a move that ends closer to the caster, goes ahead when acknowledged, and the GM undoes it', async () => {
    const room = await fearRoom()
    await castFear(room)
    await room.advanceTurn()
    const closer = { x: 350, y: 150 }

    const refused = await moveFrightenedWolf(room, [WOLF_START, closer])
    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'RULE_WARNINGS',
      warnings: [{ code: APPROACH }]
    })
    // Sideways keeps the distance; it needs no acknowledgement.
    const sideways = await moveFrightenedWolf(room, [WOLF_START, { x: 450, y: 250 }])
    expect(sideways.type, JSON.stringify(sideways)).toBe('COMMAND_COMMITTED')

    const sidewaysStart = { x: 450, y: 250 }
    const overridden = await moveFrightenedWolf(room, [sidewaysStart, closer], [APPROACH])
    expect(overridden.type, JSON.stringify(overridden)).toBe('COMMAND_COMMITTED')

    const commandId = crypto.randomUUID()
    const undone = await room.room.send(commandId, {
      scope: 'SCENE',
      command: {
        type: 'UNDO_LAST_SCENE_MOVE',
        commandId,
        expectedSceneVersion: room.room.scene.version + 2,
        sceneId: room.room.scene.id
      }
    })
    expect(undone).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { result: { delta: { kind: 'TOKEN_MOVE_UNDONE', position: sidewaysStart } } }
    })
  })

  it('warns on a teleport that ends closer to the caster, never on a forced move', async () => {
    const room = await fearRoom()
    await castFear(room)
    await room.advanceTurn()

    const teleport = await moveFrightenedWolf(room, [WOLF_START, { x: 350, y: 150 }], [], 'TELEPORT')
    expect(teleport).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'RULE_WARNINGS',
      warnings: [{ code: APPROACH }]
    })
    const forced = await moveFrightenedWolf(room, [WOLF_START, { x: 350, y: 150 }], [], 'FORCED')
    expect(forced.type, JSON.stringify(forced)).toBe('COMMAND_COMMITTED')
  })

  it('makes no repeat save at the end of the Wolf’s turn while it sees the caster (SPELLS-29.T1a)', async () => {
    const room = await fearRoom({ rolls: [0, 0] })
    await castFear(room)
    expect(room.room.diceDrawn()).toBe(2)
    const { activeEffects } = await readRoomHistory(room.room.base.stub)
    const fearOnWolf = activeEffects.find(({ targetActorId }) => targetActorId === FRIGHTENED_WOLF_ID)

    expect(await endFrightenedWolfTurn(room)).toEqual([
      expect.objectContaining({
        activeEffectId: fearOnWolf?.id,
        stage: 'END_OF_TURN',
        d20: null,
        lifecycle: expect.objectContaining({
          kind: 'UPDATE',
          beforeRemainingTicks: 10,
          afterRemainingTicks: 9
        })
      })
    ])
    expect(room.room.diceDrawn()).toBe(2)
    expect(await frightenedActorIds(room)).toEqual([FRIGHTENED_WOLF_ID, OTHER_WOLF_ID].sort())
  })

  it('lets the Wolf repeat the save out of the caster’s sight, and a success ends its Frightened (SPELLS-29.T1a)', async () => {
    // Natural 1s fail both Wolves' saves; the repeat save rolls a natural 20.
    const room = await fearRoom({ casterInvisible: true, rolls: [0, 0, 19] })
    await castFear(room)
    const { activeEffects } = await readRoomHistory(room.room.base.stub)
    const fearOnWolf = activeEffects.find(({ targetActorId }) => targetActorId === FRIGHTENED_WOLF_ID)

    expect(await endFrightenedWolfTurn(room)).toEqual([
      expect.objectContaining({
        activeEffectId: fearOnWolf?.id,
        stage: 'END_OF_TURN',
        d20: expect.objectContaining({ rawFaces: [20] }),
        lifecycle: expect.objectContaining({ kind: 'EXPIRE', beforeRemainingTicks: 10 })
      })
    ])
    expect(room.room.diceDrawn()).toBe(3)
    expect(await frightenedActorIds(room)).toEqual([OTHER_WOLF_ID])
  })

  it('takes the source with the cast when the GM undoes Fear: the move no longer warns', async () => {
    const room = await fearRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await castFear(room)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(reverted.activeEffects).toEqual([])
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))

    await room.advanceTurn()
    const moved = await moveFrightenedWolf(room, [WOLF_START, { x: 350, y: 150 }])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  })
})
