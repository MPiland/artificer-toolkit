import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import type { VoidRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import {
  concentrationAction,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { disarmInRoom, disarmRecords, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { api } from '../_generated/api'
import { classifyRuleOccurrenceVoid } from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

/** Convex's rows after the room checkpoints what it holds (a Run's state and history are the room's until then, D85). */
async function checkpointedDisarmRecords(base: Awaited<ReturnType<typeof nativeDisarmFixture>>) {
  await checkpointLiveRoom(base.campaign.id)
  return disarmRecords(base)
}

function voidCommand(input: {
  encounterId: string
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number }
}): { command: VoidRuleOccurrenceInputDto } {
  return {
    command: {
      type: 'VOID_RULE_OCCURRENCE',
      encounterId: input.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: input.pending.encounterVersion,
      occurrenceId: input.pending.occurrenceId,
      expectedOccurrenceVersion: input.pending.occurrenceVersion
    }
  }
}

async function rejectionReason(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(error instanceof ConvexError)) throw new Error('Expected a domain rejection.')
  return domainRejectionErrorDataSchema.parse(error.data).reason
}

describe('GM void decision table', () => {
  it('cancels paused actions, declines optional choices and refuses steps play needs', () => {
    expect(classifyRuleOccurrenceVoid({ kind: 'ENCOUNTER_ACTION' })).toEqual({ kind: 'CANCEL' })
    for (const kind of [
      'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
      'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'
    ] as const)
      expect(classifyRuleOccurrenceVoid({ kind })).toEqual({
        kind: 'DECLINE',
        resolution: { kind: 'DECLINE' }
      })
    expect(classifyRuleOccurrenceVoid({ kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' })).toEqual({
      kind: 'DECLINE',
      resolution: { kind: 'PASSAGE_DECLINE' }
    })
    for (const phase of ['CHOICE', 'LEGENDARY_RESISTANCE_CHOICE'] as const)
      expect(
        classifyRuleOccurrenceVoid({ kind: 'ENCOUNTER_MOVEMENT_REACTION', phase: { kind: phase } })
      ).toEqual({ kind: 'DECLINE', resolution: { kind: 'DECLINE' } })
    for (const phase of ['SPATIAL_EVIDENCE', 'CONCENTRATION_EVIDENCE', 'ACTION_EVIDENCE'] as const)
      expect(
        classifyRuleOccurrenceVoid({ kind: 'ENCOUNTER_MOVEMENT_REACTION', phase: { kind: phase } })
          .kind
      ).toBe('REFUSE')
    for (const kind of [
      'ENCOUNTER_DAMAGE_SAVE_CHECK',
      'ENCOUNTER_INITIATIVE',
      'ENCOUNTER_INITIATIVE_DECLARATION',
      'ENCOUNTER_TURN_RECHARGE',
      'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
      'ENCOUNTER_SPATIAL_MOVEMENT',
      'ENCOUNTER_CONTEST_CHECK'
    ] as const)
      expect(classifyRuleOccurrenceVoid({ kind }).kind).toBe('REFUSE')
  })
})

describe('GM void command', () => {
  it('cancels a paused Disarm whole, records the void once and settles nothing', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const before = await checkpointedDisarmRecords(base)
    const started = await disarmInRoom(base.owner, base.command)
    const pending = started.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE') throw new Error('Expected Disarm evidence.')
    const input = voidCommand({ encounterId: base.run.id, pending })
    // The room keeps command history until the Run ends (D85), so the history is read as the room sends it.
    const timelineBefore = await readRoomTimeline(base.owner.caller, base.campaign.id)

    // Only the GM voids; the room sends a cancel straight to Convex to record.
    await expect(disarmInRoom(base.player, input.command)).rejects.toThrow()
    const voided = await disarmInRoom(base.owner, input.command)
    expect(voided.occurrence).toMatchObject({
      occurrenceId: pending.occurrenceId,
      status: 'VOIDED',
      pending: null
    })
    expect(voided.projection.version).toBe(before.run!.version + 1)
    const after = await checkpointedDisarmRecords(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.character).toEqual(before.character)
    expect(after.occurrences).toEqual([
      expect.objectContaining({
        id: pending.occurrenceId,
        state: 'VOIDED',
        pendingSnapshotChecksum: null
      })
    ])
    // The void is recorded once, after the commands the Run already held (the timeline is newest first).
    const timeline = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(timeline.map((entry) => entry.commandType)).toEqual([
      'VOID_RULE_OCCURRENCE',
      ...timelineBefore.map((entry) => entry.commandType)
    ])
    // The void's retry replays its journaled result; a fresh void of the settled occurrence is stale.
    expect(await executeInRoom(base.owner.caller, input)).toEqual(voided)
    expect(
      await rejectionReason(
        executeInRoom(base.owner.caller, voidCommand({ encounterId: base.run.id, pending }))
      )
    ).toBe('VERSION_STALE')
    expect(await checkpointedDisarmRecords(base)).toEqual(after)
  }, 60_000)

  it('refuses a Concentration save and a settled occurrence without writes', async () => {
    const fixture = await setupConcentration('PROMPT')
    await seedConcentration(fixture)
    await attachFixtureRoom(fixture.t, fixture.campaign.id)
    const parent = await executeInRoom(fixture.owner.caller, {
      command: concentrationAction(fixture)
    })
    await checkpointLiveRoom(fixture.campaign.id)
    const save = await fixture.owner.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: fixture.run.id }
    )
    if (!save || save.kind !== 'D20_EVIDENCE') throw new Error('Expected a Concentration save.')
    // Convex's rows once the room checkpoints, and the history as the room sends it (D85).
    const records = async () => {
      await checkpointLiveRoom(fixture.campaign.id)
      return {
        ...(await fixture.t.run(async (ctx) => ({
          receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
          receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
          runs: await ctx.db.query('encounterRuns').collect(),
          occurrences: await ctx.db.query('encounterRuleOccurrences').collect()
        }))),
        timeline: await readRoomTimeline(fixture.owner.caller, fixture.campaign.id)
      }
    }
    const before = await records()

    expect(
      await rejectionReason(
        executeInRoom(
          fixture.owner.caller,
          voidCommand({ encounterId: fixture.run.id, pending: save })
        )
      )
    ).toBe('DECISION_REQUIRES_ANSWER')
    if (!parent.occurrence) throw new Error('Expected the settled parent occurrence.')
    expect(
      await rejectionReason(
        executeInRoom(
          fixture.owner.caller,
          voidCommand({
            encounterId: fixture.run.id,
            pending: {
              encounterVersion: save.encounterVersion,
              occurrenceId: parent.occurrence.occurrenceId,
              occurrenceVersion: parent.occurrence.occurrenceVersion
            }
          })
        )
      )
    ).toBe('VERSION_STALE')
    expect(await records()).toEqual(before)
  }, 60_000)

  it('declines movement reaction choices, keeping a paused move fenced until it settles', async () => {
    const value = await setupAutomaticSceneMovement({
      policies: ['CHOICE', 'CHOICE'],
      reactorPositions: [150, 150],
      path: [
        { x: 150, y: 50 },
        { x: 450, y: 50 }
      ]
    })
    const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    const choice = initial?.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected an issued movement choice.')

    // The room keeps command history until the Run ends (D85), so it is read as the room sends it.
    const commands = async () =>
      (await readRoomTimeline(value.owner.caller, value.base.campaign.id)).map((entry) => ({
        version: entry.version,
        commandType: entry.commandType
      }))
    const before = await commands()

    // The move pauses again at the next reactor, so the void adds no Run version or timeline entry.
    const firstSkip = voidCommand({ encounterId: value.base.run.id, pending: choice })
    const continued = await executeInRoom(value.owner.caller, firstSkip)
    const next = continued.occurrence?.pending
    if (continued.occurrence?.status !== 'PENDING' || next?.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the next movement choice.')
    expect(next.encounterVersion).toBe(choice.encounterVersion)
    expect(await commands()).toEqual(before)

    const secondSkip = voidCommand({ encounterId: value.base.run.id, pending: next })
    const voided = await executeInRoom(value.owner.caller, secondSkip)
    expect(voided.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    // A retry of the settled void is answered from the room's journal and adds nothing; a fresh void
    // of the settled decision finds it no longer pending.
    const timelineAfterVoid = await commands()
    await expect(executeInRoom(value.owner.caller, secondSkip)).resolves.toEqual(voided)
    expect(await commands()).toEqual(timelineAfterVoid)
    expect(
      await rejectionReason(
        executeInRoom(
          value.owner.caller,
          voidCommand({ encounterId: value.base.run.id, pending: next })
        )
      )
    ).toBe('DECISION_NOT_PENDING')
    await checkpointLiveRoom(value.base.campaign.id)
    const stored = await value.base.t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      occurrence: await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (query) => query.eq('id', choice.occurrenceId))
        .unique()
    }))
    const storedCommands = await commands()
    expect(stored.occurrence?.state).toBe('COMPLETED')
    // The timeline is newest first.
    expect(storedCommands.map((command) => command.commandType).slice(0, 1)).toEqual([
      'VOID_RULE_OCCURRENCE'
    ])
    expect(voided.projection.version).toBe(Math.max(...storedCommands.map((row) => row.version)))
    // Each skip is announced: a TABLE chat line and the skip record the player's drawer reads
    // (D26, D39).
    const announced = await value.base.t.run(async (ctx) => {
      const skips = await ctx.db
        .query('encounterDecisionSkips')
        .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (query) =>
          query.eq('encounterId', value.base.run.id)
        )
        .collect()
      const bodies = []
      for (const skip of [firstSkip, secondSkip]) {
        const entry = await ctx.db
          .query('campaignConversationEntries')
          .withIndex('by_campaignId_authorUserId_clientNonce', (query) =>
            query
              .eq('campaignId', value.base.campaign.id)
              .eq('authorUserId', value.owner.userId)
              .eq('clientNonce', skip.command.commandId)
          )
          .unique()
        const payload = entry
          ? await ctx.db
              .query('campaignConversationEntryPayloads')
              .withIndex('by_entryId', (query) => query.eq('entryId', entry.id))
              .unique()
          : null
        bodies.push(payload?.kind === 'CHAT' ? payload.body : null)
      }
      return { skips, bodies }
    })
    expect(announced.bodies).toEqual([
      MOVEMENT_DECISION_SKIPPED_MESSAGE,
      MOVEMENT_DECISION_SKIPPED_MESSAGE
    ])
    expect(
      announced.skips.map(({ occurrenceId, occurrenceVersion, voidCommandId }) => ({
        occurrenceId,
        occurrenceVersion,
        voidCommandId
      }))
    ).toEqual(
      expect.arrayContaining([
        {
          occurrenceId: choice.occurrenceId,
          occurrenceVersion: choice.occurrenceVersion,
          voidCommandId: firstSkip.command.commandId
        },
        {
          occurrenceId: next.occurrenceId,
          occurrenceVersion: next.occurrenceVersion,
          voidCommandId: secondSkip.command.commandId
        }
      ])
    )
    expect(announced.skips).toHaveLength(2)
  }, 60_000)
})
