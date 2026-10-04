import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  discardRoomJournal,
  endRoomEpoch,
  executeInRoom,
  readEncounterHistory,
  readHeldReplayIndex,
  replayInRoom
} from '../../tests/fixtures/liveSessionWorker'

/**
 * Four gameplay journeys through the room (V13.1) and their recovery after a reload (V13.2). Each
 * command opens a fresh room hydrated from Convex: `endRoomEpoch` keeps the room's store, so a retry
 * replays from the history it carries over; `discardRoomJournal` models storage recovery, so a retry
 * is recognized only from the Run's replay index (D85).
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
      .collect(),
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
 * Retried after the room's epoch ends with its store kept, every step replays from the history the
 * next hydrate carries over: its own dice, evidence and occurrence over the Run's current
 * projection, so the last step's replay is its exact result, with no roll and no write (no double
 * spend, reroll or recharge). A "Roll dice" replay returns only its evidence roll; its chat card and
 * decision went out with the original. A reused command ID is refused.
 */
async function expectReplayAfterNewEpoch(base: PlayerControlFixture, steps: readonly Step[]) {
  const before = await stored(base)
  const last = steps.at(-1)
  if (!last) throw new Error('A journey needs a step.')
  endRoomEpoch()
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
  endRoomEpoch()
  await expect(
    domainRejection(
      executeInRoom(first.member.caller, {
        command: { ...first.command, expectedVersion: first.command.expectedVersion + 1 }
      })
    )
  ).resolves.toMatchObject({ reason: 'COMMAND_ID_REUSED' })
  expect(await stored(base)).toEqual(before)
}

/**
 * Retried after storage recovery, the room's history is gone: each step's command ID is recognized
 * from the Run's replay index, which answers "applied at its version" over the Run's current
 * projection, with no second effect, no reroll and no decision or evidence replayed. A reused
 * command ID with other input is refused.
 */
async function expectIndexedReplayAfterRecovery(
  base: PlayerControlFixture,
  steps: readonly Step[]
) {
  const before = await stored(base)
  const last = steps.at(-1)
  const [first] = steps
  if (!last || !first) throw new Error('A journey needs a step.')
  discardRoomJournal()
  for (const { member, command } of steps) {
    const replayed = await replayInRoom(member.caller, { command })
    expect(replayed).toMatchObject({ roll: null, evidenceRoll: null, occurrence: null })
    expect(replayed.projection.version).toBe(last.result.projection.version)
  }
  expect(await stored(base)).toEqual(before)
  discardRoomJournal()
  await expect(
    executeInRoom(first.member.caller, {
      command: { ...first.command, expectedVersion: first.command.expectedVersion + 1 }
    })
  ).rejects.toThrow('The command ID was already used for different input.')
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
    await expectReplayAfterNewEpoch(base, steps)
    await expectIndexedReplayAfterRecovery(base, steps)
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
    await expectReplayAfterNewEpoch(base, steps)
    await expectIndexedReplayAfterRecovery(base, steps)
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
    await expectReplayAfterNewEpoch(base, steps)
    await expectIndexedReplayAfterRecovery(base, steps)
  }, 120000)

  it('a GM undo of an action, then the action again', async () => {
    const base = await playerControlFixture()
    const { steps, send } = journey()
    await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    const undone = await send(base.owner, await runCommand(base, 'REVERT_LAST_ACTION'))
    expect(hitPoints(undone, base.enemy.id)).toBe(base.enemy.currentHitPoints)
    const again = await send(base.owner, await base.bite(base.companion.id, base.enemy.id))
    expect(hitPoints(again, base.enemy.id)).toBeLessThan(base.enemy.currentHitPoints)
    await expectReplayAfterNewEpoch(base, steps)
    await expectIndexedReplayAfterRecovery(base, steps)
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
    await executeInRoom(base.owner.caller, {
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

    // Only the GM undoes. The recovered room holds no history of the Run, so the undo is unavailable
    // after storage recovery (a GM undo with the store kept is the fourth journey).
    const undo = await runCommand(base, 'REVERT_LAST_ACTION')
    await expect(executeInRoom(base.other.caller, { command: undo })).rejects.toThrow()
    await expect(
      domainRejection(executeInRoom(base.owner.caller, { command: undo }))
    ).resolves.toMatchObject({ reason: 'REVERT_UNAVAILABLE' })
    expect(await stored(base)).toEqual(settledState)
  }, 120000)
})

describe('Encounter history stays in the room (D85)', () => {
  it('keeps the timeline and a pending decision across a reload mid-Run', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const pending = await d20Pending(base, base.other)
    const held = () =>
      base.t.run(async (ctx) =>
        (await readEncounterHistory(ctx, base.campaign.id))
          .query('encounterRunCommands')
          .collect()
      )
    const before = await held()
    expect(before.length).toBeGreaterThan(0)
    endRoomEpoch()
    expect(await held()).toEqual(before)
    await expect(d20Pending(base, base.other)).resolves.toEqual(pending)
    const settled = await executeInRoom(base.other.caller, {
      command: settle(base, pending, {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: [3, 18],
        rollMode: 'ADVANTAGE'
      })
    })
    expect(settled.occurrence?.status ?? 'COMPLETE').toBe('COMPLETE')
    expect((await held()).length).toBeGreaterThan(before.length)
  }, 120000)

  it('lets the GM complete the Run after storage recovery with a pending decision whose receipts were lost', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await executeInRoom(base.other.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const pending = await d20Pending(base, base.other)
    discardRoomJournal()
    await expect(d20Pending(base, base.other)).resolves.toEqual(pending)
    const complete = async () => ({
      type: 'COMPLETE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version()
    })
    // As before the recovery, an open decision blocks COMPLETE until the GM settles or voids it;
    // the Run row and its occurrence live in Convex, so the lost receipts change nothing.
    await expect(
      domainRejection(executeInRoom(base.owner.caller, { command: await complete() }))
    ).resolves.toMatchObject({ reason: 'PENDING_DECISION' })
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'VOID_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion
      }
    })
    const completed = await executeInRoom(base.owner.caller, { command: await complete() })
    expect(completed.projection.status).toBe('COMPLETED')
  }, 120000)

  it('persists roll cards once, with stable ids, across two flushes', async () => {
    const base = await playerControlFixture()
    const rollCardIds = () =>
      base.t.run(async (ctx) =>
        (await ctx.db.query('campaignConversationEntryPayloads').collect())
          .filter((payload) => payload.roll !== null)
          .map((payload) => payload.entryId)
          .sort()
      )
    await executeInRoom(base.owner.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const first = await rollCardIds()
    expect(first.length).toBeGreaterThan(0)
    await executeInRoom(base.owner.caller, { command: await runCommand(base, 'ADVANCE_TURN') })
    expect(await rollCardIds()).toEqual(first)
    expect(new Set(first).size).toBe(first.length)
  }, 120000)

  it('leaves no history or replay index in Convex or the room once the Run completes', async () => {
    const base = await playerControlFixture()
    const heldIndex = () =>
      readHeldReplayIndex(base.campaign.id).filter((row) => row.encounterId === base.run.id)
    await executeInRoom(base.owner.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    expect(heldIndex()).not.toEqual([])
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'COMPLETE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version()
      }
    })
    expect(heldIndex()).toEqual([])
    const rows = await base.t.run(async (ctx) => {
      const room = await readEncounterHistory(ctx, base.campaign.id)
      const encounterId = base.run.id
      const ofRun = <Row extends { encounterId: string }>(all: Row[]) =>
        all.filter((row) => row.encounterId === encounterId)
      return {
        room: [
          ...ofRun(await room.query('encounterRunCommands').collect()),
          ...ofRun(await room.query('encounterRuleReceipts').collect()),
          ...ofRun(await room.query('encounterEvidenceRolls').collect())
        ],
        convex: [
          ...ofRun(await ctx.db.query('encounterRunCommands').collect()),
          ...ofRun(await ctx.db.query('encounterRuleReceipts').collect()),
          ...ofRun(await ctx.db.query('encounterEvidenceRolls').collect()),
          ...ofRun(await ctx.db.query('encounterReplayIndex').collect())
        ]
      }
    })
    expect(rows).toEqual({ room: [], convex: [] })
  }, 120000)
})
