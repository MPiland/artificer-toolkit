import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  discardRoomJournal,
  executeInRoom,
  replayInRoom
} from '../../tests/fixtures/liveSessionWorker'

/**
 * Four gameplay journeys through the room (V13.1) and their recovery after a reload (V13.2). Each
 * command opens a fresh room hydrated from Convex; `discardRoomJournal` models a release, so a
 * retry after it replays only from the Encounter receipts Convex holds.
 */

type Member = PlayerControlFixture['owner']
type D20Pending = Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'D20_EVIDENCE' }>
type Step = { member: Member; command: EncounterCommandInputDto; result: EncounterCommandResultDto }

const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

function readPending(base: PlayerControlFixture, member: Member) {
  return member.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
}

async function d20Pending(base: PlayerControlFixture, member: Member): Promise<D20Pending> {
  const pending = await readPending(base, member)
  if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
  return pending
}

/** Every stored row of the Run, its receipts and its evidence: a replay must leave them unchanged. */
function stored(base: PlayerControlFixture) {
  const encounterId = base.run.id
  return base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .collect(),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', encounterId))
      .collect(),
    evidenceRolls: await ctx.db.query('encounterEvidenceRolls').collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect()
  }))
}

/** Runs a journey's steps in order through the room, recording each result. */
function journey() {
  const steps: Step[] = []
  return {
    steps,
    send: async (member: Member, command: EncounterCommandInputDto) => {
      const result = await executeInRoom(member.caller, { command })
      steps.push({ member, command, result })
      return result
    }
  }
}

/**
 * After a release, every step's retry replays from the stored receipts with no roll and no write
 * (no double spend, reroll or recharge): its own dice, evidence and occurrence over the Run's
 * current projection, so the last step's replay is its exact result. A "Roll dice" replay returns
 * only its evidence roll; its chat card and decision went out with the original. A reused command
 * ID is refused.
 */
async function expectReplayAfterRelease(base: PlayerControlFixture, steps: readonly Step[]) {
  const before = await stored(base)
  const last = steps.at(-1)
  if (!last) throw new Error('A journey needs a step.')
  discardRoomJournal()
  for (const { member, command, result } of steps) {
    const replayed = await replayInRoom(member.caller, { command })
    expect(replayed).toMatchObject(
      command.type === 'ROLL_RULE_EVIDENCE'
        ? { roll: null, evidenceRoll: result.evidenceRoll, occurrence: null }
        : {
            roll: result.roll,
            evidenceRoll: result.evidenceRoll,
            occurrence: result.occurrence && { occurrenceId: result.occurrence.occurrenceId }
          }
    )
    expect(replayed.projection.version).toBe(last.result.projection.version)
  }
  expect(await replayInRoom(last.member.caller, { command: last.command })).toEqual(last.result)
  expect(await stored(base)).toEqual(before)
  const [first] = steps
  if (!first) throw new Error('A journey needs a step.')
  discardRoomJournal()
  await expect(
    domainRejection(
      executeInRoom(first.member.caller, {
        command: { ...first.command, expectedVersion: first.command.expectedVersion + 1 }
      })
    )
  ).resolves.toMatchObject({ reason: 'COMMAND_ID_REUSED' })
  expect(await stored(base)).toEqual(before)
}

function rollEvidence(base: PlayerControlFixture, pending: D20Pending): EncounterCommandInputDto {
  return {
    type: 'ROLL_RULE_EVIDENCE',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    requestId: pending.request.requestId,
    rollMode: null
  }
}

function settle(
  base: PlayerControlFixture,
  pending: D20Pending,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: pending.encounterVersion,
    correlationId: null,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    resolution
  }
}

async function runCommand(
  base: PlayerControlFixture,
  type: 'ADVANCE_TURN' | 'REVERT_LAST_ACTION'
): Promise<EncounterCommandInputDto> {
  return {
    type,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version()
  }
}

function hitPoints(result: EncounterCommandResultDto, actorId: string) {
  const actor = result.projection.actors.find((candidate) => candidate.id === actorId)
  return actor && 'currentHitPoints' in actor ? actor.currentHitPoints : undefined
}

describe('Encounter journeys through the room (V13.1)', () => {
  it('a GM action with no roll, then a turn advance', async () => {
    const base = await playerControlFixture()
    const { steps, send } = journey()
    const bitten = await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    expect(hitPoints(bitten, base.enemy.id)).toBeLessThan(base.enemy.currentHitPoints)
    const advanced = await send(base.owner, await runCommand(base, 'ADVANCE_TURN'))
    expect(advanced.projection.currentActorId).toBe(base.character.id)
    await expectReplayAfterRelease(base, steps)
  }, 120000)

  it('a player attack whose controller enters the roll', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const { steps, send } = journey()
    await send(base.other, await base.bite(base.companion.id, base.enemy.id))
    const pending = await d20Pending(base, base.other)
    const settled = await send(
      base.other,
      settle(base, pending, {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [3, 18],
        rollMode: 'ADVANTAGE'
      })
    )
    expect(settled.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    await expectReplayAfterRelease(base, steps)
  }, 120000)

  it('a player action whose enemy save the GM rolls twice and settles', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const { steps, send } = journey()
    await send(base.other, await base.bite(base.companion.id, base.enemy.id))
    const pending = await d20Pending(base, base.owner)
    await send(base.owner, rollEvidence(base, pending))
    const latest = await send(base.owner, rollEvidence(base, pending))
    if (!latest.evidenceRoll) throw new Error('Expected an app roll.')
    const settled = await send(
      base.owner,
      settle(base, pending, {
        kind: 'SYSTEM_ROLL',
        requestId: pending.request.requestId,
        rollId: latest.evidenceRoll.rollId
      })
    )
    expect(settled.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    await expectReplayAfterRelease(base, steps)
  }, 120000)

  it('a GM undo of an action, then the action again', async () => {
    const base = await playerControlFixture()
    const { steps, send } = journey()
    await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    const undone = await send(base.owner, await runCommand(base, 'REVERT_LAST_ACTION'))
    expect(hitPoints(undone, base.enemy.id)).toBe(base.enemy.currentHitPoints)
    const again = await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    expect(hitPoints(again, base.enemy.id)).toBeLessThan(base.enemy.currentHitPoints)
    await expectReplayAfterRelease(base, steps)
  }, 120000)
})

describe('Encounter recovery after a reload (V13.2)', () => {
  it('keeps refusals, privacy, authority and GM undo across a release', async () => {
    const base = await playerControlFixture({ bite: 'SAVE', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    const start = await base.bite(base.companion.id, base.enemy.id)
    await executeInRoom(base.other.caller, { command: start })
    discardRoomJournal()

    // A new action waits for the pending save, and the reloaded room keeps that save the GM's.
    const before = await stored(base)
    await expect(
      domainRejection(
        executeInRoom(base.other.caller, { command: { ...start, commandId: crypto.randomUUID() } })
      )
    ).resolves.toMatchObject({ reason: 'PENDING_DECISION' })
    for (const member of [base.other, base.player])
      await expect(readPending(base, member)).resolves.toBeNull()
    const pending = await d20Pending(base, base.owner)
    for (const member of [base.other, base.player])
      await expect(
        domainRejection(executeInRoom(member.caller, { command: rollEvidence(base, pending) }))
      ).resolves.toMatchObject({ reason: 'DECISION_NOT_PENDING' })
    expect(await stored(base)).toEqual(before)

    const rolled = await executeInRoom(base.owner.caller, { command: rollEvidence(base, pending) })
    if (!rolled.evidenceRoll) throw new Error('Expected an app roll.')
    const settled = await executeInRoom(base.owner.caller, {
      command: settle(base, pending, {
        kind: 'SYSTEM_ROLL',
        requestId: pending.request.requestId,
        rollId: rolled.evidenceRoll.rollId
      })
    })
    discardRoomJournal()
    const settledState = await stored(base)
    await expect(
      domainRejection(
        executeInRoom(base.other.caller, { command: { ...start, commandId: crypto.randomUUID() } })
      )
    ).resolves.toMatchObject({ reason: 'VERSION_STALE' })
    expect(await stored(base)).toEqual(settledState)

    // Only the GM undoes, and the undo's retry after another release replays without a write.
    const undo = await runCommand(base, 'REVERT_LAST_ACTION')
    await expect(executeInRoom(base.other.caller, { command: undo })).rejects.toThrow()
    const undone = await executeInRoom(base.owner.caller, { command: undo })
    expect(undone.projection.version).toBe(settled.projection.version + 1)
    expect(hitPoints(undone, base.enemy.id)).toBe(base.enemy.currentHitPoints)
    const afterUndo = await stored(base)
    discardRoomJournal()
    expect(await replayInRoom(base.owner.caller, { command: undo })).toEqual(undone)
    expect(await stored(base)).toEqual(afterUndo)
  }, 120000)
})
