import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { dispelMagic } from '@artificer-toolkit/source-data/srd/spells/dispel-magic.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-4.T2f1b2 (D182/D182a): a Dispel Magic cast ends the target's effects cast at or below its
 * slot outright and owes one ability check per higher-level effect, rolled by the caster under the
 * cast's own command. A success ends that effect in the same commit as its roll.
 */

const CASTER_ACTOR_ID = testUuid(0x8c0)
const CASTER_ID = testUuid(0x8c1)
const WOLF_ID = testUuid(0x8c2)
const OTHER_RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const FIRST_EFFECT_ID = testUuid(0x8c3)

/**
 * A caster who knows Dispel Magic and a Wolf holding one effect cast at each of `levels`. With
 * `linked`, the first is the others' parent: ending it ends them too.
 */
function dispelRoom(levels: readonly number[], linked = false) {
  return actionRoom({
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterSpellcasting: { spells: [dispelMagic], prepared: [dispelMagic.id] },
    characterAction: (action) => action.label === `${dispelMagic.label} (3rd level)`,
    seed: async (context) => {
      for (const [index, spellCastLevel] of levels.entries())
        await seedModifierGrant({
          sourceActorId: WOLF_ID,
          holderActorId: WOLF_ID,
          lifecycle: {},
          spellCastLevel,
          ...(linked &&
            (index === 0 ? { id: FIRST_EFFECT_ID } : { linkedEffectId: FIRST_EFFECT_ID }))
        })(context)
    }
  })
}
type DispelRoom = Awaited<ReturnType<typeof dispelRoom>>

const cast = async (room: DispelRoom) =>
  room.send({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: OTHER_RANGE,
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: CASTER_ACTOR_ID,
    target: { kind: 'ACTOR', actorId: WOLF_ID },
    actionId: room.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  })

const undo = async (room: DispelRoom) =>
  room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })

/** The caster enters `face` for the pending check's d20. */
async function enterD20(room: DispelRoom, face: number) {
  const roll = await room.pendingDecision()
  if (roll.pending.kind !== 'D20_EVIDENCE')
    throw new Error(`Expected the d20, got ${roll.pending.kind}.`)
  expect(roll.pending.rollerActorId).toBe(CASTER_ACTOR_ID)
  return room.resolve(roll, {
    kind: 'ENTER_DICE',
    requestId: roll.pending.request.requestId,
    rawFaces: [face],
    rollMode: roll.pending.request.rollMode
  })
}

const heldEffectCount = async (room: DispelRoom) =>
  (await readRoomHistory(room.room.base.stub)).activeEffects.length

/** The check outputs of every settled receipt, in commit order. */
async function checkOutputs(room: DispelRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' && execution.applicationOutputs?.kind === 'CHECK_ACTION'
      ? [{ receipt, outputs: execution.applicationOutputs }]
      : []
  })
}

describe('Dispel Magic cast in the room (SPELLS-4.T2f1b2)', () => {
  it('ends the effects at or below the slot and pends a check for the higher one', async () => {
    const room = await dispelRoom([1, 3, 5])
    const answer = await cast(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(1)
    const roll = await room.pendingDecision()
    expect(roll.pending.kind).toBe('D20_EVIDENCE')
  })

  it('ends the higher effect in the same commit as the successful roll', async () => {
    const room = await dispelRoom([5])
    await cast(room)
    expect(await heldEffectCount(room)).toBe(1)
    const settled = await enterD20(room, 20)
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(0)
    const [only] = await checkOutputs(room)
    expect(only?.outputs).toMatchObject({
      kind: 'CHECK_ACTION',
      outcome: 'SUCCESS',
      source: { kind: 'SPELL_CAST' }
    })
  })

  it('keeps the higher effect when the roll fails', async () => {
    const room = await dispelRoom([5])
    await cast(room)
    const settled = await enterD20(room, 1)
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(1)
    const [only] = await checkOutputs(room)
    expect(only?.outputs).toMatchObject({ outcome: 'FAILURE' })
  })

  it('walks the candidates in order, one roll each', async () => {
    const room = await dispelRoom([4, 5])
    await cast(room)
    expect((await enterD20(room, 20)).type).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(1)
    expect((await enterD20(room, 20)).type).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(0)
    expect(await checkOutputs(room)).toHaveLength(2)
  })

  it('commits without a pending roll when nothing higher is held', async () => {
    const room = await dispelRoom([1, 2])
    const answer = await cast(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(0)
    expect(await checkOutputs(room)).toHaveLength(0)
  })

  it('undoes the cast and its settled checks refuse', async () => {
    const room = await dispelRoom([5])
    await cast(room)
    await enterD20(room, 1)
    const undone = await undo(room)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(1)
  })

  it('refuses to undo a dispel that ended an effect', async () => {
    const room = await dispelRoom([5])
    await cast(room)
    await enterD20(room, 20)
    const refused = await undo(room)
    expect(refused.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(refused)).toContain('dispel ended')
    expect(await heldEffectCount(room)).toBe(0)
  })

  it('skips a candidate that ended with the one before it', async () => {
    const room = await dispelRoom([4, 5], true)
    await cast(room)
    expect((await enterD20(room, 20)).type).toBe('COMMAND_COMMITTED')
    expect(await heldEffectCount(room)).toBe(0)
    expect(await checkOutputs(room)).toHaveLength(1)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('answers a replayed roll without rolling or ending anything twice', async () => {
    const room = await dispelRoom([4, 5])
    await cast(room)
    const roll = await room.pendingDecision()
    if (roll.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the d20.')
    const command = room.resolveCommand(roll, {
      kind: 'ENTER_DICE',
      requestId: roll.pending.request.requestId,
      rawFaces: [20],
      rollMode: roll.pending.request.rollMode
    })
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    const afterFirst = await checkOutputs(room)
    expect(afterFirst).toHaveLength(1)
    const replayed = await room.send(command)
    expect(replayed.type, JSON.stringify(replayed)).toBe('COMMAND_COMMITTED')
    expect(await checkOutputs(room)).toHaveLength(1)
    expect(await heldEffectCount(room)).toBe(1)
  })

  it('refuses to void the pending roll and keeps it waiting', async () => {
    const room = await dispelRoom([5])
    await cast(room)
    const roll = await room.pendingDecision()
    const voided = await room.send({
      type: 'VOID_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: room.room.encounterId,
      expectedVersion: roll.encounterVersion,
      occurrenceId: roll.occurrence.id,
      expectedOccurrenceVersion: roll.occurrence.version
    })
    expect(voided).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'DECISION_REQUIRES_ANSWER'
    })
    expect(await heldEffectCount(room)).toBe(1)
    expect((await room.pendingDecision()).occurrence.id).toBe(roll.occurrence.id)
  })
})
