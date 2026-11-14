import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { sanctuary } from '@artificer-toolkit/source-data/srd/spells/sanctuary.js'
import { scorchingRay } from '@artificer-toolkit/source-data/srd/spells/scorching-ray.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorHitPoints,
  readPendingActionDecision,
  readPendingApplicationContext,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-13.T1c5a: each ray of a chosen list is its own attack, so each owes the incoming gate of the
 * creature it is aimed at. A pass is kept with that ray alone; a ray that fails is lost, deals nothing
 * and leaves a receipt of the failed save under the cast, and the list goes on. The engine knows no
 * feature: the SRD Sanctuary is the gate and the SRD Scorching Ray is the list.
 */

const CASTER_ACTOR_ID = testUuid(0x9e0)
const CASTER_ID = testUuid(0x9e1)
const WARDED_ID = testUuid(0x9e2)
const OPEN_ID = testUuid(0x9e3)
const WARDER_ACTOR_ID = testUuid(0x9e4)
const WARDER_ID = testUuid(0x9e5)
const WOLF_HIT_POINTS = 40
/** Natural d20 faces: a save that passes any Sanctuary DC, one that fails it, and a hit that is no critical hit. */
const SAVE_PASSES = 20
const SAVE_FAILS = 1
const HIT = 19

const [warding] = sanctuary.effects ?? []

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A Caster with Scorching Ray, a Wolf under another Character's Sanctuary and a Wolf under none.
 * `rolls` are the next dice the room rolls (zero-based: a natural face less one).
 */
function wardedRoom(config: { autoRoll?: 'EVERYONE'; rolls?: readonly number[] } = {}) {
  if (!warding) throw new Error('The SRD Sanctuary has no effect.')
  const wolf = { ...plainWolf, hitPoints: WOLF_HIT_POINTS }
  return actionRoom({
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: WARDED_ID, creature: wolf, currentHitPoints: WOLF_HIT_POINTS }),
      srdCreatureActor({ id: OPEN_ID, creature: wolf, currentHitPoints: WOLF_HIT_POINTS }),
      characterActor({ id: WARDER_ACTOR_ID, characterId: WARDER_ID })
    ],
    characterSpellcasting: { spells: [scorchingRay], prepared: [scorchingRay.id] },
    secondCharacter: {
      characterId: WARDER_ID,
      spellcasting: { spells: [sanctuary], prepared: [sanctuary.id] }
    },
    characterAction: (action) => action.label === 'Scorching Ray (2nd level)',
    ...(config.autoRoll && { autoRoll: config.autoRoll }),
    rolls: config.rolls ?? [],
    fallbackRoll: 0,
    seed: seedModifierGrant({
      sourceActorId: WARDER_ACTOR_ID,
      holderActorId: WARDED_ID,
      lifecycle: {},
      effect: warding,
      sourceLabel: sanctuary.label
    })
  })
}
type Room = Awaited<ReturnType<typeof wardedRoom>>

async function standing(room: Room) {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    wards: history.activeEffects.length,
    warded: readActorHitPoints(history, WARDED_ID),
    open: readActorHitPoints(history, OPEN_ID),
    /** The receipts of the rays lost at a gate. */
    lost: history.receipts.flatMap((receipt) => {
      const execution = parseReceiptExecution(receipt)
      return receipt.commandType === 'RESOLVE_ACTION' &&
        execution.status === 'AGGREGATE_CHOICE_COMPLETE' &&
        execution.applicationOutputs.kind === 'ENCOUNTER_GATED_ACTION'
        ? [execution.applicationOutputs]
        : []
    })
  }
}

async function cast(room: Room, targets: readonly string[]) {
  const { answer } = await room.startActorsAction(targets, [], true)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The one d20 the list now asks its caster for is entered as `face`; the answer must commit. */
async function roll(room: Room, face: number) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES')
    throw new Error(`Expected the pending rolls, got ${decision.pending.kind}.`)
  expect(decision.pending.saves).toHaveLength(1)
  const { request } = decision.pending.saves[0]!
  const answer = await room.send(
    room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: [face],
      rollMode: request.rollMode
    })
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** The pending list's rays, each with its own sealed attack. */
async function rays(room: Room) {
  const context = await readPendingApplicationContext(room.room.base.stub)
  if (context.kind !== 'ENCOUNTER_AREA_ACTION') throw new Error('Expected the pending ray list.')
  return context.targets.map((target) => {
    const inner = target.snapshot.applicationContext
    if (inner.kind !== 'ENCOUNTER_ACTION') throw new Error('Expected a ray’s attack.')
    return { target, inner }
  })
}

describe('each ray of a chosen list owes its creature’s incoming gate (QUALITY-13.T1c5a)', () => {
  it('asks the save before each ray at the warded creature, loses the ray that fails and goes on', async () => {
    const room = await wardedRoom()
    const before = await standing(room)
    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])

    // The first ray is held on the ward before anything of it is rolled.
    const [held, waiting] = await rays(room)
    if (held?.inner.pause?.kind !== 'INCOMING_GATE')
      throw new Error(`Expected the first ray on its gate, got ${held?.inner.pause?.kind}.`)
    expect(held.inner.pause.payload.origin).toMatchObject({
      kind: 'WARD',
      holderActorId: WARDED_ID
    })
    expect(waiting?.inner.pause).toBeUndefined()

    // It passes, so it is rolled as an attack, and it hits.
    await roll(room, SAVE_PASSES)
    const [passed] = await rays(room)
    expect(passed?.inner.pause).toBeUndefined()
    expect(passed?.inner.passedIncomingGate?.origin).toMatchObject({ holderActorId: WARDED_ID })
    expect(passed?.target.testedJson).toBeUndefined()
    await roll(room, HIT)

    // The pass was the first ray's alone: the second owes the save again, fails it and is lost.
    const [, second] = await rays(room)
    expect(second?.inner.pause?.kind).toBe('INCOMING_GATE')
    expect(second?.inner.passedIncomingGate).toBeUndefined()
    await roll(room, SAVE_FAILS)
    const [, lost, third] = await rays(room)
    expect(lost?.target.testedJson).toBeDefined()
    expect(lost?.target.lost?.gate.origin).toMatchObject({ kind: 'WARD', holderActorId: WARDED_ID })

    // The list goes on: the ray at the creature under no ward owes no save, only its attack roll.
    expect(third?.inner.pause).toBeUndefined()
    expect(third?.inner.passedIncomingGate).toBeUndefined()
    await roll(room, HIT)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    const oneRay = before.open - after.open
    expect(oneRay).toBeGreaterThan(0)
    // Every die of the damage rolls the same face, so one ray landed on each creature.
    expect(before.warded - after.warded).toBe(oneRay)
    expect(after.wards).toBe(before.wards)
    expect(after.lost).toHaveLength(1)
    expect(after.lost[0]).toMatchObject({
      lost: 'SPELL',
      sourceActorId: CASTER_ACTOR_ID,
      gate: { origin: { kind: 'WARD', holderActorId: WARDED_ID } }
    })
    expect(after.lost[0]?.parentOccurrenceId).toBeDefined()
  })

  it('ends a list whose rays are all lost with no effect, and the cast is undone as one action', async () => {
    const room = await wardedRoom()
    const before = await standing(room)
    await cast(room, [WARDED_ID, WARDED_ID, WARDED_ID])

    await roll(room, SAVE_FAILS)
    await roll(room, SAVE_FAILS)
    await roll(room, SAVE_FAILS)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    expect(after.warded).toBe(before.warded)
    expect(after.open).toBe(before.open)
    expect(after.wards).toBe(before.wards)
    expect(after.lost).toHaveLength(3)
    expect(new Set(after.lost.map(({ parentOccurrenceId }) => parentOccurrenceId)).size).toBe(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await standing(room)).wards).toBe(before.wards)
  })

  it('rolls each gate for a caster who auto-rolls: the lost ray deals nothing and the rest land', async () => {
    // The first ray's save fails; the second's passes, its attack hits and its two damage dice roll;
    // the third owes no save and hits.
    const room = await wardedRoom({
      autoRoll: 'EVERYONE',
      rolls: [SAVE_FAILS - 1, SAVE_PASSES - 1, HIT - 1, 0, 0, HIT - 1]
    })
    const before = await standing(room)

    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    const oneRay = before.open - after.open
    expect(oneRay).toBeGreaterThan(0)
    expect(before.warded - after.warded).toBe(oneRay)
    expect(after.lost).toHaveLength(1)
    expect(after.lost[0]?.gate.origin).toMatchObject({ kind: 'WARD', holderActorId: WARDED_ID })
  })
})
