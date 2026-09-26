import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { describe, expect, it, vi } from 'vitest'
import type {
  EncounterCommandResultDto,
  EncounterExecuteInput,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import {
  concentrationAction,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import { disarmInRoom, disarmRecords, nativeDisarmFixture } from '../../tests/fixtures/nativeDisarm'
import { api, internal } from '../_generated/api'
import { classifyRuleOccurrenceVoid } from './occurrenceVoid'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn(() => 0) }))

const executeCommand = makeFunctionReference<
  'action',
  EncounterExecuteInput,
  EncounterCommandResultDto
>('encounters/commandActions:execute')
type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
const prepareVoid = makeFunctionReference<
  'mutation',
  VoidRuleOccurrenceInputDto,
  { kind: 'DECLINE'; command: ResolveRuleOccurrenceInputDto } | { kind: 'COMPLETE' | 'RECORD' }
>('encounters/occurrenceVoid:prepare')

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
      'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK',
      'ENCOUNTER_INITIATIVE',
      'ENCOUNTER_INITIATIVE_DECLARATION',
      'ENCOUNTER_TURN_RECHARGE',
      'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
      'ENCOUNTER_SPATIAL_MOVEMENT',
      'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
    ] as const)
      expect(classifyRuleOccurrenceVoid({ kind }).kind).toBe('REFUSE')
  })
})

describe('GM void command', () => {
  it('cancels a paused Disarm whole, records the void once and settles nothing', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const before = await disarmRecords(base)
    const started = await disarmInRoom(base, base.owner, base.command)
    const pending = started.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE') throw new Error('Expected Disarm evidence.')
    const input = voidCommand({ encounterId: base.run.id, pending })

    // Only the GM voids; the room sends a cancel straight to Convex to record.
    await expect(disarmInRoom(base, base.player, input.command)).rejects.toThrow()
    const voided = await disarmInRoom(base, base.owner, input.command)
    expect(voided.occurrence).toMatchObject({
      occurrenceId: pending.occurrenceId,
      status: 'VOIDED',
      pending: null
    })
    expect(voided.projection.version).toBe(before.run!.version + 1)
    const after = await disarmRecords(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.character).toEqual(before.character)
    expect(after.occurrences).toEqual([
      expect.objectContaining({
        id: pending.occurrenceId,
        state: 'VOIDED',
        pendingSnapshotJson: null
      })
    ])
    expect(after.commands.map((command) => command.commandType)).toEqual([
      ...before.commands.map((command) => command.commandType),
      'VOID_RULE_OCCURRENCE'
    ])
    const timeline = await base.owner.caller.query(api.encounters.timelineReads.timeline, {
      encounterId: base.run.id,
      limit: 1
    })
    expect(timeline.entries[0]).toMatchObject({ commandType: 'VOID_RULE_OCCURRENCE' })
    await expect(base.owner.caller.action(executeCommand, input)).resolves.toEqual(voided)
    expect(
      await rejectionReason(
        base.owner.caller.action(executeCommand, voidCommand({ encounterId: base.run.id, pending }))
      )
    ).toBe('DECISION_NOT_PENDING')
    expect(await disarmRecords(base)).toEqual(after)
  }, 60_000)

  it('refuses a Concentration save and a settled occurrence without writes', async () => {
    const fixture = await setupConcentration('PROMPT')
    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
        .unique()
      if (!row) throw new Error('Concentration fixture Run is unavailable.')
      await seedActiveInitiative(ctx, encounterRunStateSchema.parse(JSON.parse(row.stateJson)), [
        fixture.actor.id,
        fixture.target.id
      ])
    })
    await seedConcentration(fixture)
    const parent = await fixture.owner.caller.mutation(internal.encounters.commands.execute, {
      command: concentrationAction(fixture)
    })
    const save = await fixture.owner.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: fixture.run.id }
    )
    if (!save || save.kind !== 'D20_EVIDENCE') throw new Error('Expected a Concentration save.')
    const records = () =>
      fixture.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect()
      }))
    const before = await records()

    expect(
      await rejectionReason(
        fixture.owner.caller.action(
          executeCommand,
          voidCommand({ encounterId: fixture.run.id, pending: save })
        )
      )
    ).toBe('DECISION_REQUIRES_ANSWER')
    if (!parent.occurrence) throw new Error('Expected the settled parent occurrence.')
    expect(
      await rejectionReason(
        fixture.owner.caller.action(
          executeCommand,
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
    ).toBe('DECISION_NOT_PENDING')
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
    await value.owner.caller.mutation(observe, { saveId: value.saveId, characterRevisions: [] })
    await value.owner.caller.mutation(prepare, value.request)
    const initial = await value.owner.caller.mutation(finish, value.request)
    const choice = initial.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected an issued movement choice.')

    const commands = () =>
      value.base.t.run((ctx) =>
        ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId', (query) => query.eq('encounterId', value.base.run.id))
          .collect()
      )
    const before = await commands()

    // The move pauses again at the next reactor, so the void adds no Run version or timeline entry.
    const firstSkip = voidCommand({ encounterId: value.base.run.id, pending: choice })
    const continued = await value.owner.caller.action(executeCommand, firstSkip)
    const next = continued.occurrence?.pending
    if (continued.occurrence?.status !== 'PENDING' || next?.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the next movement choice.')
    expect(next.encounterVersion).toBe(choice.encounterVersion)
    expect(await commands()).toEqual(before)

    const secondSkip = voidCommand({ encounterId: value.base.run.id, pending: next })
    const skipRows = () =>
      value.base.t.run((ctx) =>
        ctx.db
          .query('encounterDecisionSkips')
          .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (query) =>
            query.eq('encounterId', value.base.run.id)
          )
          .collect()
      )
    // Crash window: the decline commits, then the orchestrator dies before recording the void.
    const planned = await value.owner.caller.mutation(prepareVoid, secondSkip.command)
    if (planned.kind !== 'DECLINE') throw new Error('Expected the void to decline the choice.')
    await value.owner.caller.action(executeCommand, { command: planned.command })
    expect(await skipRows()).toHaveLength(1)
    // The retry finds the committed decline and announces the skip once; a replay adds nothing.
    const voided = await value.owner.caller.action(executeCommand, secondSkip)
    expect(voided.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(await value.owner.caller.action(executeCommand, secondSkip)).toEqual(voided)
    const stored = await value.base.t.run(async (ctx) => ({
      occurrence: await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (query) => query.eq('id', choice.occurrenceId))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (query) => query.eq('encounterId', value.base.run.id))
        .collect()
    }))
    expect(stored.occurrence?.state).toBe('COMPLETED')
    expect(stored.commands.map((command) => command.commandType).slice(-1)).toEqual([
      'VOID_RULE_OCCURRENCE'
    ])
    expect(voided.projection.version).toBe(
      Math.max(...stored.commands.map((row) => row.version ?? 0))
    )
    // The native path (a Scene the room does not own, D29) announces each skip like the room does:
    // a TABLE chat line and the skip record the player's drawer reads (D26, D39).
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
