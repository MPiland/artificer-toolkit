import { describe, expect, it } from 'vitest'
import {
  reactionInput,
  reactionRecords,
  setupCreatureReactionRun
} from '../../tests/fixtures/movementReaction'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'

import { readDefinitionRoot } from '../content/definitionStore'
import {
  prepareNativeMovementReactionAction,
  planNativeMovementReactionAction,
  settleNativeMovementReactionAction,
  resumeNativeMovementLegendaryResistance,
  type NativeMovementReactionSettlementInput
} from './actionMovementReactions'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { makeFunctionReference } from 'convex/server'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { createRulesRuntime } from '../rules/runtime'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { replayNativeMovementReactionAction } from './movementReactionReplay'
import { retainEncounterMovementReactionActionEvidence } from '@artificer-toolkit/rules-runtime/encounterMovementReactionContinuation'
import { bindEncounterMovementReactionInterruption } from '@artificer-toolkit/rules-runtime/encounterMovementReactionExecution'
import {
  prepareNativeActionTest,
  continueNativeActionAfterTest
} from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import {
  retainNativeMovementLegendaryResistance,
  resolveNativeMovementLegendaryResistance,
  replayNativeMovementLegendaryResistance
} from '@artificer-toolkit/rules-runtime/encounterMovementLegendaryResistance'

const prepareScene = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')
const finishScene = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneGeometryCommandResult
>('scenes/geometryCommands:finish')

it.each([false, true])(
  'retains and resolves the issued Legendary Resistance decision (use=%s) without writes',
  async (use) => {
    const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
      outcomeDice: true
    })
    const scene = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
    const staged = await scene.owner.caller.mutation(prepareScene, scene.request)
    expect(staged.outcome.kind).toBe('PENDING')
    await scene.owner.caller.mutation(finishScene, scene.request)
    const before = await reactionRecords(base.t, base.run.id)
    let settlement!: NativeMovementReactionSettlementInput
    await scene.owner.caller.run(async (ctx) => {
      const occurrence = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (q) => q.eq('id', staged.occurrenceId))
        .unique()
      if (!occurrence?.pendingSnapshotJson) throw new Error('Missing issued Scene choice.')
      const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(
        JSON.parse(occurrence.pendingSnapshotJson)
      )
      const context = snapshot.applicationContext
      if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' || context.phase.kind !== 'CHOICE')
        throw new Error('Missing actual reaction choice context.')
      const first = context.reactionTimeline[0]
      if (first?.kind !== 'CONTROLLER_CHOICE') throw new Error('Missing controller choice.')
      const option = first.group.options[0]!
      const prepared = await prepareNativeMovementReactionAction(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: occurrence.expectedEncounterVersion,
        movementKind: context.root.movementKind,
        occurrenceId: occurrence.id,
        option,
        actorIdByTokenId: new Map(
          scene.tokens.map((token, index) => [token.id, [base.reactor, base.mover][index]!.id])
        ),
        tokens: scene.tokens.map((token) =>
          token.id === scene.moverTokenId
            ? { ...token, position: context.root.currentPosition }
            : token
        ),
        resolvePerception: async () => true
      })
      const runtime = await createRulesRuntime(ctx, scene.owner.userId)
      const action = {
        runtime,
        adapter: prepared.prepared.adapter,
        plan: prepared.executionPlan,
        occurrenceId: occurrence.id,
        binding: prepared.prepared.binding,
        automationMode: 'AUTOMATIC' as const,
        afterTest: async () => undefined,
        random: () => 0
      }
      const boundary = await prepareNativeActionTest(action)
      if (boundary.kind !== 'TEST_BOUNDARY') throw new Error('Missing failed SAVE TEST.')
      const candidate = await discoverEncounterLegendaryResistanceCandidate({
        encounter: prepared.prepared.state,
        targetActor: prepared.prepared.target,
        actorRules: prepared.prepared.actorRules,
        definitions: {
          requireCurrent: async (id) => {
            const root = await readDefinitionRoot(ctx, id, scene.owner.userId)
            if (!root?.current) throw new Error('Missing LR definition.')
            return root.current
          }
        }
      })
      if (!candidate) throw new Error('Missing LR candidate.')
      const retained = await retainNativeMovementLegendaryResistance({
        runtime,
        occurrenceId: occurrence.id,
        prepared,
        context,
        execution: boundary.execution,
        d20: boundary.d20,
        candidate
      })
      const retainedContext = retained.applicationContext
      if (
        retainedContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
        retainedContext.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE'
      )
        throw new Error('Missing LR decision.')
      const replayedChoice = await replayNativeMovementReactionAction({
        ctx,
        runtime,
        prepared,
        occurrenceId: occurrence.id,
        retained: { kind: 'PENDING', snapshot: retained }
      })
      expect(replayedChoice.kind).toBe('LEGENDARY_RESISTANCE')
      const currentFeatureResource = prepared.prepared.actorRules.actors
        .find((actor) => actor.actorId === candidate.targetActorId)
        ?.featureResources.find((feature) => feature.featureId === candidate.ownerFeatureId)
      if (!currentFeatureResource) throw new Error('Missing LR resource.')
      const resolutionInput = {
        runtime,
        occurrenceId: occurrence.id,
        prepared,
        snapshot: retained,
        candidate,
        testD20Policy: boundary.d20Policy,
        currentFeatureResource
      }
      await expect(
        resolveNativeMovementLegendaryResistance({
          ...resolutionInput,
          selection: { kind: 'OPTION', optionId: 'unissued' }
        })
      ).rejects.toThrow('not issued')
      await expect(
        resolveNativeMovementLegendaryResistance({
          ...resolutionInput,
          candidate: { ...candidate, poolBefore: candidate.poolBefore - 1 },
          selection: { kind: 'DECLINE' }
        })
      ).rejects.toThrow('stale')
      const resolved = await resolveNativeMovementLegendaryResistance({
        ...resolutionInput,
        selection: use
          ? { kind: 'OPTION', optionId: retainedContext.phase.resistance.useOptionId }
          : { kind: 'DECLINE' }
      })
      expect(resolved.chargeProposal).toEqual(
        use
          ? expect.objectContaining({
              beforeUsed: 0,
              afterUsed: 1,
              beforeRemaining: 3,
              afterRemaining: 2
            })
          : null
      )
      const originalChecksum = checksumRuleDocument(boundary.execution)
      const replayInput = {
        ...resolutionInput,
        execution: boundary.execution,
        d20: boundary.d20,
        audit: resolved.audit
      }
      expect(await replayNativeMovementLegendaryResistance(replayInput)).toEqual(resolved)
      await expect(
        replayNativeMovementLegendaryResistance({
          ...replayInput,
          audit: { ...resolved.audit, selection: use ? 'DECLINE' : 'USE' }
        })
      ).rejects.toThrow('choice execution is stale')
      await expect(
        replayNativeMovementLegendaryResistance({
          ...replayInput,
          audit: {
            ...resolved.audit,
            resistance: { ...resolved.audit.resistance, useOptionId: 'f'.repeat(64) }
          }
        })
      ).rejects.toThrow('decision is stale')
      await expect(
        continueNativeActionAfterTest({
          ...action,
          boundary,
          legendaryResistance: resolved.audit,
          effectivePath: use ? 'ON_SAVE_FAIL' : 'ON_SAVE_SUCCESS'
        })
      ).rejects.toThrow('does not match its Legendary Resistance decision')
      if (!use) {
        const pending = await continueNativeActionAfterTest({
          ...action,
          automationMode: 'ASSISTED',
          boundary,
          legendaryResistance: resolved.audit
        })
        expect(pending.kind).toBe('PENDING')
        if (pending.kind !== 'PENDING') throw new Error('Missing actual OUTCOME request.')
        const retainedResponse = {
          runtime,
          prepared,
          occurrenceId: occurrence.id,
          snapshot: retained,
          automationMode: 'ASSISTED' as const,
          retainedExecution: pending
        }
        await expect(
          resumeNativeMovementLegendaryResistance(ctx, {
            ...retainedResponse,
            selection: { kind: 'DECLINE' }
          })
        ).resolves.toEqual(pending)
        await expect(
          resumeNativeMovementLegendaryResistance(ctx, {
            ...retainedResponse,
            selection: { kind: 'OPTION', optionId: retainedContext.phase.resistance.useOptionId }
          })
        ).rejects.toThrow('does not match the issued response')
        const secondDie = await continueNativeActionAfterTest({
          ...action,
          automationMode: 'ASSISTED',
          boundary,
          legendaryResistance: resolved.audit,
          resume: {
            pending,
            resolution: {
              kind: 'ENTER_INTEGER',
              requestId: pending.continuation.request.requestId,
              value: pending.continuation.request.min
            }
          }
        })
        if (secondDie.kind !== 'PENDING') throw new Error('Missing second OUTCOME die.')
        const secondSnapshot = retainEncounterMovementReactionActionEvidence({
          continuation: secondDie.continuation,
          context,
          selectedOptionId: option.optionId,
          d20Policy: secondDie.d20Policy,
          ...(secondDie.twoPhase ? { twoPhase: secondDie.twoPhase } : {}),
          ...(secondDie.phaseReceipts ? { phaseReceipts: secondDie.phaseReceipts } : {})
        })
        await expect(
          replayNativeMovementReactionAction({
            ctx,
            runtime,
            prepared,
            occurrenceId: occurrence.id,
            retained: { kind: 'PENDING', snapshot: secondSnapshot }
          })
        ).resolves.toEqual(secondDie)
        await expect(
          replayNativeMovementReactionAction({
            ctx,
            runtime,
            prepared,
            occurrenceId: occurrence.id,
            retained: {
              kind: 'PENDING',
              snapshot: {
                ...secondSnapshot,
                request: { ...secondSnapshot.request, max: secondSnapshot.request.max - 1 }
              }
            }
          })
        ).rejects.toThrow('The retained movement reaction pending evidence is stale.')
      }
      const completed = await continueNativeActionAfterTest({
        ...action,
        boundary,
        effectivePath: resolved.effectivePath,
        legendaryResistance: resolved.audit
      })
      expect(completed.kind).toBe('COMPLETE')
      if (completed.kind !== 'COMPLETE') throw new Error('Missing action completion.')
      expect(completed.phaseReceipts?.[0]?.execution.outputs.resultPath).toBe('ON_SAVE_FAIL')
      expect(checksumRuleDocument(boundary.execution)).toBe(originalChecksum)
      expect(completed.applications.length).toBe(use ? 0 : 1)
      const input = {
        prepared,
        occurrenceId: occurrence.id,
        commandId: crypto.randomUUID(),
        ordinal: 0,
        occurredAt: new Date().toISOString(),
        execution: {
          ...completed,
          execution: bindEncounterMovementReactionInterruption(
            completed.execution,
            completed.phaseReceipts,
            prepared.action.movementInterruption,
            resolved.effectivePath
          ),
          resistance: resolved
        }
      }
      const planned = planNativeMovementReactionAction(input, scene.owner.userId)
      expect(planned.reactionExecution.legendaryResistance?.use).toBe(use)
      expect(planned.application).toMatchObject({
        targetFeatureResourceConsumption: resolved.chargeProposal
      })
      const replayed = await replayNativeMovementReactionAction({
        ctx,
        runtime,
        prepared,
        occurrenceId: occurrence.id,
        retained: { kind: 'COMPLETE', receipt: planned.reactionExecution }
      })
      expect(replayed.kind).toBe('COMPLETE')
      if (replayed.kind !== 'COMPLETE') throw new Error('Missing replayed action completion.')
      expect(replayed.resistance).toEqual(resolved)
      const retainedResponse = {
        runtime,
        prepared,
        occurrenceId: occurrence.id,
        snapshot: retained,
        automationMode: 'AUTOMATIC' as const,
        retainedExecution: replayed
      }
      const selection = use
        ? { kind: 'OPTION' as const, optionId: retainedContext.phase.resistance.useOptionId }
        : { kind: 'DECLINE' as const }
      expect(
        await resumeNativeMovementLegendaryResistance(ctx, { ...retainedResponse, selection })
      ).toEqual(replayed)
      await expect(
        resumeNativeMovementLegendaryResistance(ctx, {
          ...retainedResponse,
          selection: use
            ? { kind: 'DECLINE' }
            : { kind: 'OPTION', optionId: retainedContext.phase.resistance.useOptionId }
        })
      ).rejects.toThrow('does not match the issued response')
      expect(
        planNativeMovementReactionAction({ ...input, execution: replayed }, scene.owner.userId)
      ).toEqual(planned)
      await expect(
        replayNativeMovementReactionAction({
          ctx,
          runtime,
          prepared,
          occurrenceId: occurrence.id,
          retained: {
            kind: 'COMPLETE',
            receipt: {
              ...planned.reactionExecution,
              legendaryResistance: { ...resolved.legendaryResistance, use: !use }
            }
          }
        })
      ).rejects.toThrow('receipt is stale')
      settlement = input
    })
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    await expect(
      scene.owner.caller.run(async (ctx) => {
        await settleNativeMovementReactionAction(ctx, settlement)
        throw new Error('Verify enclosing LR rollback.')
      })
    ).rejects.toThrow('Verify enclosing LR rollback.')
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    const committed = await scene.owner.caller.run((ctx) =>
      settleNativeMovementReactionAction(ctx, settlement)
    )
    expect(committed.reactionExecution.legendaryResistance?.use).toBe(use)
    expect(committed.application).toMatchObject({
      targetFeatureResourceConsumption: use
        ? expect.objectContaining({ beforeUsed: 0, afterUsed: 1 })
        : null
    })
  },
  30000
)

describe('native movement Legendary Resistance fixture', () => {
  it('prepares a real issued failed-save reaction against a Legendary Resistance Creature without writes', async () => {
    const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', true)
    const input = reactionInput({
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      reactorActorId: base.reactor.id,
      movingActorId: base.mover.id,
      occurrenceId: crypto.randomUUID()
    })
    const before = await reactionRecords(base.t, base.run.id)
    await base.owner.caller.run(async (ctx) => {
      const discovered = await discoverNativeMovementReactions(ctx, input)
      const entry = discovered.reactionTimeline[0]
      if (!entry || entry.kind !== 'CONTROLLER_CHOICE') throw new Error('Missing issued choice.')
      const option = entry.group.options[0]
      if (!option) throw new Error('Missing issued reaction option.')
      const prepared = await prepareNativeMovementReactionAction(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        movementKind: input.movementKind,
        occurrenceId: input.occurrenceId,
        option,
        actorIdByTokenId: input.actorIdByTokenId,
        tokens: input.tokens,
        resolvePerception: input.resolvePerception
      })
      const candidate = await discoverEncounterLegendaryResistanceCandidate({
        encounter: prepared.prepared.state,
        targetActor: prepared.prepared.target,
        actorRules: prepared.prepared.actorRules,
        definitions: {
          requireCurrent: async (definitionId) => {
            const definition = await readDefinitionRoot(ctx, definitionId, base.owner.userId)
            if (!definition?.current) throw new Error('Definition unavailable.')
            return definition.current
          }
        }
      })
      expect(candidate).toMatchObject({ targetActorId: base.mover.id, poolBefore: 3 })
    })
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  }, 30000)
})
