import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActorTokenBindingCommandInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api } from '../_generated/api'
import {
  executeInRoom,
  expectRedactedRoomRefusal,
  planMovementDecisionInRoom,
  planMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'
// Keep handler compilation outside the per-operation test timer.
import '../content/import'
import '../betterAuth/adapter'
import '../auth'
import '../account'
import '../campaigns/create'
import '../encounters/blueprints'
import '../encounters/runs'
import '../encounters/actorTokenBindings'
import './geometryCommands'
import './movementResolutionStaging'
import './movementResolutionReads'

const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  { projection: { version: number } }
>('encounters/actorTokenBindings:execute')
// A racing loser reads the winner's occurrence version, Encounter scope or Scene binding, or an
// unavailable occurrence, and the room reports it as a redacted refusal. Once the winner completes
// the occurrence, a loser's answer is a stale Encounter version.
const staleResponse =
  /Movement response (?:occurrence|Encounter scope|Scene binding) is stale\.|Rule occurrence is unavailable\./
const versionStale = { code: 'DOMAIN_REJECTED', reason: 'VERSION_STALE' }

async function setup(selected = false) {
  const base = await setupCreatureReactionRun(null, selected, true)
  // The GM selects the reaction and rolls its dice; prompt for them as evidence.
  if (selected) await setAutoRollDice(base.t, base.owner.userId, false)
  if (!base.additionalReactorActor) throw new Error('Fixture additional reactor missing.')
  const sceneId = crypto.randomUUID()
  const definitionSaveId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const now = new Date().toISOString()
  const tokens: SceneDefinitionDto['tokens'] = [50, 150, 50].map((x, index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: index === 1 ? [base.other.userId] : [],
    width: 100,
    height: 100,
    hidden: false,
    locked: false,
    label: index === 0 ? 'Reactor' : 'Mover',
    position: { x, y: 50 },
    rotationDegrees: 0,
    vision: null
  }))
  const settings = {
    campaignId: base.campaign.id,
    name: 'Response scene',
    ambientIllumination: 'BRIGHT' as const,
    fogMode: 'SHARED_PARTY' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid: {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    },
    map: {
      assetId: crypto.randomUUID(),
      width: 1000,
      height: 1000,
      tileManifestAssetId: null
    }
  }
  await base.t.run(async (ctx) => {
    const definitionId = crypto.randomUUID()
    const materializationCommandId = crypto.randomUUID()
    await ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      joinedAt: now,
      accessStartedAt: now,
      leftAt: null
    })
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...settings,
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId,
        version: 0,
        materializationCommandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: definitionSaveId,
        commandId: materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.owner.userId,
        definitionId,
        expectedVersion: null,
        settings,
        counts: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: 3
        },
        received: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: 3
        },
        status: 'PUBLISHED',
        liveSceneId: sceneId,
        entitiesRemoved: false,
        createdAt: now,
        expiresAt: Date.now() + 60_000
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId: definitionSaveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: base.campaign.id,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId,
      commandId: rootCommandId,
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: now
    })
  })
  let version = base.run.version
  for (const [index, actor] of [base.reactor, base.mover, base.additionalReactorActor].entries()) {
    const result = await base.owner.caller.mutation(bindActorToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id,
        expectedEncounterVersion: version,
        actorId: actor.id,
        sceneId,
        tokenId: tokens[index]!.id
      }
    })
    version = result.projection.version
  }
  const rootInput = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId,
    commandId: rootCommandId,
    expectedSceneVersion: 0,
    expectedEncounterVersion: version,
    correlationId: null,
    tokenId: tokens[1]!.id,
    movementKind: 'VOLUNTARY' as const,
    path: [
      { x: 150, y: 50 },
      { x: 300, y: 50 }
    ]
  }
  return { base, sceneId, tokens, rootInput }
}

describe('room movement response publication', () => {
  it('settles a selected GM Creature reaction through its issued evidence and replays the current occurrence', async () => {
    const value = await setup(true)
    const rootPlan = await planMovementInRoom(value.base.owner.caller, value.rootInput)
    expect(rootPlan.outcome.kind).toBe('PENDING')
    const root = await rootPlan.publish()
    const choice = root.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected issued movement reaction choice.')
    const option = choice.choice.options[0]
    if (!option) throw new Error('Expected issued movement reaction option.')
    const selected: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'OPTION', optionId: option.optionId }
    }
    const beforePreparation = await value.base.t.run(async (ctx) => ({
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      receipts: await ctx.db.query('encounterRuleReceipts').collect(),
      commands: await ctx.db.query('encounterRunCommands').collect(),
      sceneCommands: await ctx.db.query('sceneLiveCommands').collect()
    }))
    let lastCommand = selected
    let plan = await planMovementDecisionInRoom(value.base.owner.caller, selected)
    expect(plan.outcome.kind).toBe('PENDING')
    expect(
      await value.base.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect()
      }))
    ).toEqual(beforePreparation)
    let result = await plan.publish()
    const beforeCompletion = beforePreparation.runs[0]
    if (!beforeCompletion) throw new Error('Expected encounter Run.')
    const evidenceKinds: PendingEncounterRuleOccurrenceSummaryDto['kind'][] = []
    let sawSubsequentReactor = false
    while (result.occurrence?.status === 'PENDING') {
      const pending = result.occurrence.pending
      if (
        !pending ||
        (pending.kind !== 'MOVEMENT_REACTION' &&
          pending.kind !== 'D20_EVIDENCE' &&
          pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      )
        throw new Error('Expected selected reaction evidence request.')
      if (pending.kind !== 'MOVEMENT_REACTION') evidenceKinds.push(pending.kind)
      if (pending.kind === 'MOVEMENT_REACTION') sawSubsequentReactor = true
      const command: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution:
          pending.kind === 'MOVEMENT_REACTION'
            ? { kind: 'DECLINE' }
            : pending.kind === 'D20_EVIDENCE'
              ? {
                  kind: 'ENTER_DICE',
                  requestId: pending.request.requestId,
                  rawFaces: pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
                  rollMode: pending.request.rollMode
                }
              : {
                  kind: 'ENTER_INTEGER',
                  requestId: pending.request.requestId,
                  value: pending.request.max
                }
      }
      lastCommand = command
      plan = await planMovementDecisionInRoom(value.base.owner.caller, command)
      expect(plan.outcome.kind).toBe(pending.kind === 'MOVEMENT_REACTION' ? 'TERMINAL' : 'PENDING')
      result = await plan.publish()
    }
    // The natural 20 is a critical hit: the reaction's two damage dice are each rolled twice (D58).
    expect(evidenceKinds).toEqual([
      'D20_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE',
      'ACTION_OUTCOME_EVIDENCE'
    ])
    expect(sawSubsequentReactor).toBe(true)
    expect(result.occurrence).toMatchObject({
      status: 'COMPLETE',
      pending: null
    })
    const completed = await value.base.t.run(async (ctx) => ({
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      receipts: await ctx.db.query('encounterRuleReceipts').collect(),
      commands: await ctx.db.query('encounterRunCommands').collect(),
      sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
      fog: await ctx.db.query('sceneFogLayers').collect()
    }))
    expect(completed.runs[0]?.version).toBe(beforeCompletion.version + 2)
    expect(completed.actors).not.toEqual(beforePreparation.actors)
    expect(completed.receipts.length).toBeGreaterThan(beforePreparation.receipts.length)
    const source = completed.actors.find((actor) => actor.id === choice.choice.reactorActorId)
    const target = completed.actors.find((actor) => actor.id === value.base.mover.id)
    const priorTarget = beforePreparation.actors.find((actor) => actor.id === value.base.mover.id)
    if (!source || !target || !priorTarget) throw new Error('Expected selected reaction actors.')
    expect(
      encounterRunActorStateSchema.parse(JSON.parse(source.stateJson)).resources
    ).toMatchObject({
      ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
    })
    const targetState = encounterRunActorStateSchema.parse(JSON.parse(target.stateJson))
    const priorTargetState = encounterRunActorStateSchema.parse(JSON.parse(priorTarget.stateJson))
    if (targetState.kind === 'CHARACTER' || priorTargetState.kind === 'CHARACTER')
      throw new Error('Expected a Creature reaction target.')
    expect(targetState.currentHitPoints).toBeLessThan(priorTargetState.currentHitPoints)
    await expect(
      (await planMovementDecisionInRoom(value.base.owner.caller, lastCommand)).publish()
    ).resolves.toMatchObject({
      replayed: true,
      occurrence: { status: 'COMPLETE' }
    })
    await expect(
      (await planMovementInRoom(value.base.owner.caller, value.rootInput)).publish()
    ).resolves.toEqual({ ...root, replayed: true })
    expect(
      await value.base.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
        fog: await ctx.db.query('sceneFogLayers').collect()
      }))
    ).toEqual(completed)
  })

  it('races every reaction response to one winner and one stale loser, spending the reaction once', async () => {
    const value = await setup(true)
    const { t, owner, run } = value.base
    const root = await (await planMovementInRoom(owner.caller, value.rootInput)).publish()
    const stored = () =>
      t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect()
      }))
    const reactionStart = await stored()
    const losers: string[] = []
    let selected = false
    let pending = root.occurrence?.pending ?? null
    while (pending) {
      if (
        pending.kind !== 'MOVEMENT_REACTION' &&
        pending.kind !== 'D20_EVIDENCE' &&
        pending.kind !== 'ACTION_OUTCOME_EVIDENCE'
      )
        throw new Error('Expected a movement reaction response.')
      const current = pending
      const option = pending.kind === 'MOVEMENT_REACTION' ? pending.choice.options[0] : undefined
      const resolution: ResolveRuleOccurrenceInputDto['resolution'] =
        pending.kind === 'MOVEMENT_REACTION'
          ? !selected && option
            ? { kind: 'OPTION', optionId: option.optionId }
            : { kind: 'DECLINE' }
          : pending.kind === 'D20_EVIDENCE'
            ? {
                kind: 'ENTER_DICE',
                requestId: pending.request.requestId,
                rawFaces: pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
                rollMode: pending.request.rollMode
              }
            : {
                kind: 'ENTER_INTEGER',
                requestId: pending.request.requestId,
                value: pending.request.max
              }
      if (resolution.kind === 'OPTION') selected = true
      const contenders = [crypto.randomUUID(), crypto.randomUUID()].map((commandId) => ({
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE' as const,
          commandId,
          encounterId: run.id,
          expectedVersion: current.encounterVersion,
          occurrenceId: current.occurrenceId,
          expectedOccurrenceVersion: current.occurrenceVersion,
          correlationId: null,
          resolution
        }
      }))
      const raced = await Promise.allSettled(
        contenders.map((input) => executeInRoom(owner.caller, input))
      )
      const winnerIndex = raced.findIndex((result) => result.status === 'fulfilled')
      const winner = raced[winnerIndex]
      const loser = raced[1 - winnerIndex]
      if (winner?.status !== 'fulfilled' || loser?.status !== 'rejected')
        throw new Error('Reaction response contention needs one winner and one stale loser.')
      const expectStaleLoser = (attempt: Promise<unknown>) =>
        winner.value.occurrence?.status === 'COMPLETE'
          ? expect(attempt).rejects.toMatchObject({ data: versionStale })
          : expectRedactedRoomRefusal(attempt, staleResponse)
      await expectStaleLoser(Promise.reject(loser.reason))
      losers.push(contenders[1 - winnerIndex]!.command.commandId)
      const settled = await stored()
      // The room commits a movement decision with its Scene and refuses a settled one's retry.
      await expectRedactedRoomRefusal(
        executeInRoom(owner.caller, contenders[winnerIndex]!),
        'This decision was already settled.',
        'STALE_STATE'
      )
      await expectStaleLoser(executeInRoom(owner.caller, contenders[1 - winnerIndex]!))
      expect(await stored()).toEqual(settled)
      pending =
        winner.value.occurrence?.status === 'PENDING' ? winner.value.occurrence.pending : null
    }
    expect(selected).toBe(true)
    const final = await stored()
    const choice = root.occurrence?.pending
    if (choice?.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the issued reaction choice.')
    const reactor = final.actors.find((actor) => actor.id === choice.choice.reactorActorId)
    if (!reactor) throw new Error('Expected the selected reactor.')
    expect(
      encounterRunActorStateSchema.parse(JSON.parse(reactor.stateJson)).resources
    ).toMatchObject({
      ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
    })
    // A stale loser leaves no command, receipt, occurrence or Scene trace.
    expect(JSON.stringify(final)).not.toMatch(new RegExp(losers.join('|')))
    // Each Run version the winners committed carries exactly one command receipt.
    const committed = final.runs[0]!.version - reactionStart.runs[0]!.version
    expect(committed).toBeGreaterThan(0)
    expect(final.commands.length - reactionStart.commands.length).toBe(committed)
    // The timeline re-parses every stored receipt against its checksum.
    const timeline = await owner.caller.query(api.encounters.timelineReads.timeline, {
      encounterId: run.id,
      limit: 100
    })
    expect(timeline.entries.map((entry) => entry.version)).toContain(final.runs[0]!.version)
    await expect(
      (await planMovementInRoom(owner.caller, value.rootInput)).publish()
    ).resolves.toEqual({ ...root, replayed: true })
    expect(await stored()).toEqual(final)
  }, 90_000)

  it('publishes repeated GM declines and replays the current complete occurrence', async () => {
    const value = await setup()
    const initial = await planMovementInRoom(value.base.owner.caller, value.rootInput)
    expect(initial.outcome.kind).toBe('PENDING')
    const root = await initial.publish()
    expect(root.occurrence).toMatchObject({
      status: 'PENDING',
      occurrenceVersion: 0
    })
    const rootOccurrence = root.occurrence
    if (!rootOccurrence?.pending) throw new Error('Expected response pending summary.')
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: rootOccurrence.pending.encounterVersion,
      occurrenceId: rootOccurrence.occurrenceId,
      expectedOccurrenceVersion: rootOccurrence.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'DECLINE' }
    }
    await expect(
      planMovementDecisionInRoom(value.base.other.caller, command)
    ).rejects.toMatchObject({ data: { reason: 'NOT_ACTOR_CONTROLLER' } })
    const plan = await planMovementDecisionInRoom(value.base.owner.caller, command)
    expect(plan.outcome.kind).toBe('PENDING')
    const before = await value.base.t.run((ctx) => ctx.db.query('encounterRuns').collect())
    const first = await plan.publish()
    expect(first).toMatchObject({
      replayed: false,
      version: root.version,
      delta: null,
      occurrence: { status: 'PENDING', occurrenceVersion: 1 }
    })
    const after = await value.base.t.run((ctx) => ctx.db.query('encounterRuns').collect())
    expect(after[0]!.version).toBe(before[0]!.version)
    if (!first.occurrence?.pending) throw new Error('Expected second pending choice.')
    const secondCommand: ResolveRuleOccurrenceInputDto = {
      ...command,
      commandId: crypto.randomUUID(),
      expectedVersion: first.occurrence.pending.encounterVersion,
      expectedOccurrenceVersion: first.occurrence.occurrenceVersion
    }
    const second = await planMovementDecisionInRoom(value.base.owner.caller, secondCommand)
    expect(second.outcome.kind).toBe('TERMINAL')
    const result = await second.publish()
    // The reach contact is at x = 200, so the declined move finishes its remaining path.
    expect(result).toMatchObject({
      delta: { kind: 'TOKEN_MOVED', position: { x: 300, y: 50 } },
      version: first.version + 1,
      occurrence: { status: 'COMPLETE', occurrenceVersion: 2 }
    })
    expect(
      (await value.base.t.run((ctx) => ctx.db.query('encounterRuns').collect()))[0]!.version
    ).toBe(before[0]!.version + 1)
    const retryState = await value.base.t.run(async (ctx) => ({
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      receipts: await ctx.db.query('encounterRuleReceipts').collect(),
      runCommands: await ctx.db.query('encounterRunCommands').collect(),
      sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
      fogRows: await ctx.db.query('sceneFogLayers').collect()
    }))
    await expect(
      (await planMovementDecisionInRoom(value.base.owner.caller, command)).publish()
    ).resolves.toEqual({ ...first, replayed: true })
    await expect(
      (await planMovementInRoom(value.base.owner.caller, value.rootInput)).publish()
    ).resolves.toEqual({ ...root, replayed: true })
    expect(
      await value.base.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receipts: await ctx.db.query('encounterRuleReceipts').collect(),
        runCommands: await ctx.db.query('encounterRunCommands').collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
        fogRows: await ctx.db.query('sceneFogLayers').collect()
      }))
    ).toEqual(retryState)
  })
})
