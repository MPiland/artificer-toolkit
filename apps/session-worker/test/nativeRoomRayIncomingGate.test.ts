import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  encounterAreaNamedActorId,
  encounterChosenActorEntries,
  turnEncounterAreaRay
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { encounterAttackRetargetUseOptionId } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
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
  readPendingRootSnapshot,
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
const DEFEATED_ID = testUuid(0x9e6)
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
function wardedRoom(
  config: {
    autoRoll?: 'EVERYONE'
    rolls?: readonly number[]
    /** The other Wolf is under the Character's Sanctuary too. */
    bothWarded?: true
    /** A third Wolf, defeated, stands in the encounter. */
    defeatedWolf?: true
  } = {}
) {
  if (!warding) throw new Error('The SRD Sanctuary has no effect.')
  const wolf = { ...plainWolf, hitPoints: WOLF_HIT_POINTS }
  const ward = (holderActorId: string) =>
    seedModifierGrant({
      sourceActorId: WARDER_ACTOR_ID,
      holderActorId,
      lifecycle: {},
      effect: warding,
      sourceLabel: sanctuary.label
    })
  return actionRoom({
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: WARDED_ID, creature: wolf, currentHitPoints: WOLF_HIT_POINTS }),
      srdCreatureActor({ id: OPEN_ID, creature: wolf, currentHitPoints: WOLF_HIT_POINTS }),
      characterActor({ id: WARDER_ACTOR_ID, characterId: WARDER_ID }),
      ...(config.defeatedWolf
        ? [
            srdCreatureActor({
              id: DEFEATED_ID,
              creature: wolf,
              currentHitPoints: 0,
              defeated: true
            })
          ]
        : [])
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
    seed: async (context) => {
      await ward(WARDED_ID)(context)
      if (config.bothWarded) await ward(OPEN_ID)(context)
    }
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

/** The offer to turn the ray a ward stopped: the caster's choice before the ray is lost. */
async function retargetOffer(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'ATTACK_RETARGET_CHOICE')
    throw new Error(`Expected the retarget offer, got ${decision.pending.kind}.`)
  expect(decision.pending.attackerActorId).toBe(CASTER_ACTOR_ID)
  return { decision, options: decision.pending.options }
}

/** Lets the ward lose the ray instead of turning it on another creature. */
async function declineRetarget(room: Room) {
  const { decision } = await retargetOffer(room)
  const lost = await room.resolve(decision, { kind: 'DECLINE' })
  expect(lost.type, JSON.stringify(lost)).toBe('COMMAND_COMMITTED')
}

/** Turns the ray the offer holds on `actorId`; the answer must commit. */
async function turn(room: Room, actorId: string) {
  const { decision, options } = await retargetOffer(room)
  const turned = await room.resolve(decision, {
    kind: 'OPTION',
    optionId: options.find((option) => option.targetActorId === actorId)!.optionId
  })
  expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')
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
    // The caster is offered another creature before the ray is lost (T1c5b), and declines.
    await declineRetarget(room)
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

    // Each failed save offers that ray another creature (T1c5b); the caster declines each.
    for (let ray = 0; ray < 3; ray += 1) {
      await roll(room, SAVE_FAILS)
      await declineRetarget(room)
    }

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
    // Turning a stopped ray is the caster's choice, never rolled for them (T1c5b): once they
    // decline, the rest of the list rolls on.
    await declineRetarget(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    const oneRay = before.open - after.open
    expect(oneRay).toBeGreaterThan(0)
    expect(before.warded - after.warded).toBe(oneRay)
    expect(after.lost).toHaveLength(1)
    expect(after.lost[0]?.gate.origin).toMatchObject({ kind: 'WARD', holderActorId: WARDED_ID })
  })
})

describe('a ray a ward stopped may be turned on another creature, that ray alone (QUALITY-13.T1c5b)', () => {
  it('turns the stopped ray inside its own entry and leaves the rays behind it as they were named', async () => {
    const room = await wardedRoom()
    const before = await standing(room)
    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])
    const named = (await rays(room)).map(({ target }) => target.snapshot.occurrenceId)

    await roll(room, SAVE_FAILS)
    const { decision, options } = await retargetOffer(room)
    // The warded creature and the caster are no candidates.
    const offered = options.map((option) => option.targetActorId)
    expect(offered).toContain(OPEN_ID)
    expect(offered).not.toContain(WARDED_ID)
    expect(offered).not.toContain(CASTER_ACTOR_ID)
    const turned = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: options.find((option) => option.targetActorId === OPEN_ID)!.optionId
    })
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')

    // The entry keeps its occurrence, is aimed at the chosen creature and records the failed save.
    const [first, second, third] = await rays(room)
    expect((await rays(room)).map(({ target }) => target.snapshot.occurrenceId)).toEqual(named)
    expect(first?.target.actorId).toBe(OPEN_ID)
    expect(first?.target.lost).toBeUndefined()
    expect(first?.target.testedJson).toBeUndefined()
    expect(first?.target.retargeted).toHaveLength(1)
    expect(first?.target.retargeted?.[0]?.origin).toMatchObject({
      kind: 'WARD',
      holderActorId: WARDED_ID
    })
    expect(first?.inner.pause).toBeUndefined()
    // The rays behind it are still the ones the list named.
    expect(second?.target.actorId).toBe(WARDED_ID)
    expect(second?.target.retargeted).toBeUndefined()
    expect(third?.target.actorId).toBe(OPEN_ID)
    expect(third?.target.retargeted).toBeUndefined()

    // The turned ray is rolled at the creature under no ward, and hits.
    await roll(room, HIT)
    // The second ray still owes the ward its own save: it passes and hits the warded creature.
    expect((await rays(room))[1]?.inner.pause?.kind).toBe('INCOMING_GATE')
    await roll(room, SAVE_PASSES)
    await roll(room, HIT)
    await roll(room, HIT)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    const oneRay = before.warded - after.warded
    expect(oneRay).toBeGreaterThan(0)
    // Every die of the damage rolls the same face: the turned ray and the third both landed here.
    expect(before.open - after.open).toBe(2 * oneRay)
    expect(after.lost).toHaveLength(0)
    expect(after.wards).toBe(before.wards)
  })

  it('rolls the turned ray and the rays behind it for a caster who auto-rolls', async () => {
    // The first ray's save fails. Once it is turned it hits and rolls its two damage dice; the
    // second's save passes, it hits and rolls its damage; the third owes no save and hits.
    const room = await wardedRoom({
      autoRoll: 'EVERYONE',
      rolls: [SAVE_FAILS - 1, HIT - 1, 0, 0, SAVE_PASSES - 1, HIT - 1, 0, 0, HIT - 1]
    })
    const before = await standing(room)
    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])

    const { decision, options } = await retargetOffer(room)
    const turned = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: options.find((option) => option.targetActorId === OPEN_ID)!.optionId
    })
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    const oneRay = before.warded - after.warded
    expect(oneRay).toBeGreaterThan(0)
    expect(before.open - after.open).toBe(2 * oneRay)
    expect(after.lost).toHaveLength(0)
  })

  it('refuses a creature the offer did not name and keeps the offer', async () => {
    const room = await wardedRoom()
    await cast(room, [WARDED_ID, OPEN_ID])
    await roll(room, SAVE_FAILS)
    const { decision } = await retargetOffer(room)
    const [ward] = (await readRoomHistory(room.room.base.stub)).activeEffects
    if (!ward) throw new Error('The warded creature holds no effect.')

    const refused = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: encounterAttackRetargetUseOptionId({
        gateEffectId: ward.id,
        targetActorId: WARDED_ID
      })
    })

    expect(refused.type).not.toBe('COMMAND_COMMITTED')
    const [held] = await rays(room)
    expect(held?.inner.pause?.kind).toBe('ATTACK_RETARGET')
    expect(held?.target.actorId).toBe(WARDED_ID)
  })

  it('asks the turned ray the save of the creature it was turned on, and loses it there under its own entry', async () => {
    const room = await wardedRoom({ bothWarded: true })
    const before = await standing(room)
    await cast(room, [WARDED_ID, OPEN_ID])
    const [turnedEntry] = (await rays(room)).map(({ target }) => target.snapshot.occurrenceId)

    await roll(room, SAVE_FAILS)
    await turn(room, OPEN_ID)
    // The creature it was turned on is warded too: the ray owes that ward afresh.
    const [atSecondWard] = await rays(room)
    if (atSecondWard?.inner.pause?.kind !== 'INCOMING_GATE')
      throw new Error(`Expected the turned ray on a gate, got ${atSecondWard?.inner.pause?.kind}.`)
    expect(atSecondWard.inner.pause.payload.origin).toMatchObject({
      kind: 'WARD',
      holderActorId: OPEN_ID
    })
    expect(atSecondWard.target.testedJson).toBeUndefined()

    // It fails that save too; the caster declines the next offer and the ray is lost at this ward.
    await roll(room, SAVE_FAILS)
    const again = await retargetOffer(room)
    expect(again.options.map((option) => option.targetActorId)).not.toContain(OPEN_ID)
    await declineRetarget(room)
    const [lost] = await rays(room)
    expect(lost?.target.snapshot.occurrenceId).toBe(turnedEntry)
    expect(lost?.target.actorId).toBe(OPEN_ID)
    expect(lost?.target.lost?.gate.origin).toMatchObject({ kind: 'WARD', holderActorId: OPEN_ID })
    expect(lost?.target.retargeted?.map(({ origin }) => origin)).toMatchObject([
      { kind: 'WARD', holderActorId: WARDED_ID }
    ])

    // The second ray, named at that creature, owes its ward on its own: it passes and hits.
    expect((await rays(room))[1]?.inner.pause?.kind).toBe('INCOMING_GATE')
    await roll(room, SAVE_PASSES)
    await roll(room, HIT)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    expect(after.warded).toBe(before.warded)
    expect(before.open - after.open).toBeGreaterThan(0)
    expect(after.wards).toBe(before.wards)
    expect(after.lost).toHaveLength(1)
    expect(after.lost[0]).toMatchObject({
      occurrenceId: turnedEntry,
      gate: { origin: { kind: 'WARD', holderActorId: OPEN_ID } }
    })
  })

  it('lets the turned ray land once it passes the save of the creature it was turned on', async () => {
    const room = await wardedRoom({ bothWarded: true })
    const before = await standing(room)
    await cast(room, [WARDED_ID, OPEN_ID])

    await roll(room, SAVE_FAILS)
    await turn(room, OPEN_ID)
    await roll(room, SAVE_PASSES)
    const [passed, second] = await rays(room)
    expect(passed?.inner.pause).toBeUndefined()
    expect(passed?.inner.passedIncomingGate?.origin).toMatchObject({ holderActorId: OPEN_ID })
    expect(passed?.target.retargeted?.[0]?.origin).toMatchObject({ holderActorId: WARDED_ID })
    await roll(room, HIT)
    // The pass was the turned ray's alone: the ray named at that creature owes the save again.
    expect(second?.inner.passedIncomingGate).toBeUndefined()
    expect((await rays(room))[1]?.inner.pause?.kind).toBe('INCOMING_GATE')
    await roll(room, SAVE_PASSES)
    await roll(room, HIT)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    expect(after.warded).toBe(before.warded)
    expect(before.open - after.open).toBeGreaterThan(0)
    expect(after.lost).toHaveLength(0)
  })

  it('refuses to turn the ray on a creature one attack could not be turned on, and keeps the offer', async () => {
    const room = await wardedRoom({ defeatedWolf: true })
    await cast(room, [WARDED_ID, OPEN_ID])
    await roll(room, SAVE_FAILS)
    const { decision, options } = await retargetOffer(room)

    // The list did not acknowledge a defeated target, so the ray is not turned on one.
    const refused = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: options.find((option) => option.targetActorId === DEFEATED_ID)!.optionId
    })

    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'RULE_WARNINGS' })
    expect(JSON.stringify(refused)).toContain('TARGET_DEFEATED')
    const [held] = await rays(room)
    expect(held?.inner.pause?.kind).toBe('ATTACK_RETARGET')
    expect(held?.target.actorId).toBe(WARDED_ID)
    // The offer stands: the ray may still be turned on a creature the list could have named.
    await turn(room, OPEN_ID)
    expect((await rays(room))[0]?.target.actorId).toBe(OPEN_ID)
  })

  it('turns only the ray its offer holds, on a creature the offer names, under the entry it was named at', async () => {
    const room = await wardedRoom()
    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])
    await roll(room, SAVE_FAILS)
    const snapshot = await readPendingRootSnapshot(room.room.base.stub)
    if (snapshot.snapshotKind !== 'AGGREGATE_CHOICE') throw new Error('Expected the pending list.')
    const [held, behind, third] = (await rays(room)).map(({ target }) => target)
    if (!held || !behind || !third) throw new Error('Expected three rays.')
    const requestId = held.snapshot.request.requestId
    const onto = {
      actorId: OPEN_ID,
      // The token of the creature the third ray is already aimed at.
      token: third.token,
      perceivedByCaster: true,
      snapshot: held.snapshot
    }

    // A turned ray is sealed afresh: one still held on the ward that stopped it is no entry.
    expect(() => turnEncounterAreaRay(snapshot, requestId, onto)).toThrow(
      'A ray’s incoming gate is the ward of the creature it is aimed at.'
    )
    const refusal = 'This ray has no retarget to make.'
    // A ray no offer holds, a creature the offer does not name, and another entry's occurrence.
    expect(() =>
      turnEncounterAreaRay(snapshot, behind.snapshot.request.requestId, {
        ...onto,
        snapshot: behind.snapshot
      })
    ).toThrow(refusal)
    expect(() =>
      turnEncounterAreaRay(snapshot, requestId, { ...onto, actorId: WARDED_ID })
    ).toThrow(refusal)
    expect(() =>
      turnEncounterAreaRay(snapshot, requestId, { ...onto, snapshot: behind.snapshot })
    ).toThrow(refusal)

    // Turned through the room, the list still names what it named: the turned ray counts as the
    // creature it was named at, so every entry keeps the occurrence its ordinal gives it.
    await turn(room, OPEN_ID)
    const turned = (await rays(room)).map(({ target }) => target)
    expect(turned.map(({ actorId }) => actorId)).toEqual([OPEN_ID, WARDED_ID, OPEN_ID])
    const named = turned.map(encounterAreaNamedActorId)
    expect(named).toEqual([WARDED_ID, WARDED_ID, OPEN_ID])
    expect(
      encounterChosenActorEntries(snapshot.occurrenceId, named).map((entry) => entry.occurrenceId)
    ).toEqual(turned.map((target) => target.snapshot.occurrenceId))
    expect(turned.slice(1)).toEqual([behind, third])
  })

  it('settles a gate-held ray with the d20 the app rolled for its caster', async () => {
    const room = await wardedRoom({ rolls: [SAVE_PASSES - 1] })
    await cast(room, [WARDED_ID, OPEN_ID])
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the pending rolls.')
    const { request } = decision.pending.saves[0]!

    const rolled = await room.send({
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: decision.encounterVersion,
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version,
      requestId: request.requestId,
      rollMode: null
    })
    expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(room.room.base.stub)).evidenceRolls
    expect(held.map((row) => row.faces)).toEqual([[SAVE_PASSES]])
    // The held roll settles nothing by itself: the ray still waits on its gate.
    expect((await rays(room))[0]?.inner.pause?.kind).toBe('INCOMING_GATE')

    const settled = await room.resolve(decision, {
      kind: 'SYSTEM_ROLL',
      requestId: request.requestId,
      rollId: held[0]!.id
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    const [passed] = await rays(room)
    expect(passed?.inner.pause).toBeUndefined()
    expect(passed?.inner.passedIncomingGate).toMatchObject({
      origin: { kind: 'WARD', holderActorId: WARDED_ID },
      d20: { rawFaces: [SAVE_PASSES] }
    })
    expect(passed?.target.testedJson).toBeUndefined()
  })

  it('keeps a creature in the list while a ray turned on it is unanswered', async () => {
    const room = await wardedRoom()
    await cast(room, [WARDED_ID, OPEN_ID])
    await roll(room, SAVE_FAILS)
    const { decision, options } = await retargetOffer(room)
    const turned = await room.resolve(decision, {
      kind: 'OPTION',
      optionId: options.find((option) => option.targetActorId === OPEN_ID)!.optionId
    })
    expect(turned.type, JSON.stringify(turned)).toBe('COMMAND_COMMITTED')
    const named = (await rays(room)).map(({ target }) => target.snapshot.occurrenceId)

    // The turned ray holds the entry of the creature it was named at, so it cannot leave with this one.
    const refused = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), OPEN_ID)
    )

    expect(refused.type).not.toBe('COMMAND_COMMITTED')
    const left = await rays(room)
    expect(left.map(({ target }) => target.snapshot.occurrenceId)).toEqual(named)
    expect(left.map(({ target }) => target.actorId)).toEqual([OPEN_ID, OPEN_ID])
  })

  it('takes only the unanswered rays with a creature the GM removes: its lost ray keeps its receipt', async () => {
    const room = await wardedRoom()
    const before = await standing(room)
    await cast(room, [WARDED_ID, WARDED_ID, OPEN_ID])
    const [lostEntry, , openEntry] = (await rays(room)).map(
      ({ target }) => target.snapshot.occurrenceId
    )

    await roll(room, SAVE_FAILS)
    await declineRetarget(room)
    // The second ray waits on the ward; the GM takes the warded creature out of the list.
    const removed = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), WARDED_ID)
    )
    expect(removed.type, JSON.stringify(removed)).toBe('COMMAND_COMMITTED')

    // The lost ray stays answered under its own entry, and the ray at the other creature under its own.
    const left = await rays(room)
    expect(left.map(({ target }) => target.snapshot.occurrenceId)).toEqual([lostEntry, openEntry])
    expect(left[0]?.target.lost?.gate.origin).toMatchObject({ holderActorId: WARDED_ID })
    await roll(room, HIT)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const after = await standing(room)
    expect(after.warded).toBe(before.warded)
    expect(before.open - after.open).toBeGreaterThan(0)
    expect(after.lost).toHaveLength(1)
    expect(after.lost[0]).toMatchObject({
      occurrenceId: lostEntry,
      gate: { origin: { kind: 'WARD', holderActorId: WARDED_ID } }
    })
  })
})
