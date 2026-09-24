import { afterEach, expect, it, vi } from 'vitest'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { createRulesRuntime } from '../rules/runtime'
import * as rollRandom from '../lib/rollRandom'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readRunActor, readRunState } from './documents'
import {
  evaluateNativeSpatialMovement,
  settleNativeSpatialMovementPrefix,
  type NativeSpatialMovementInput
} from './spatialMovement'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it.each(['ASSISTED', 'AUTOMATIC', 'AUTOMATIC_PREPARED', 'ASSISTED_PREFIX'] as const)(
  'pauses native Character spatial damage, rejects stale resume, and publishes exact entered evidence (%s)',
  async (scenario) => {
    const automationMode = scenario.startsWith('AUTOMATIC') ? 'AUTOMATIC' : 'ASSISTED'
    vi.stubEnv('BETTER_AUTH_SECRET', 'native-spatial-test-secret-at-least-32-bytes')
    const base = await setupCharacterRun()
    const sceneId = crypto.randomUUID()
    const tokenId = crypto.randomUUID()
    const commandId = crypto.randomUUID()
    const occurrenceId = crypto.randomUUID()
    const definitionId = crypto.randomUUID()
    const entryId = crypto.randomUUID()
    const effectId = crypto.randomUUID()
    const occurredAt = new Date().toISOString()
    const graph = {
      schemaVersion: 1,
      id: definitionId,
      gameSystemId: base.run.gameSystemId,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      nodes: [
        {
          id: 'd20',
          operation: { key: 'evidence.integer-range', contractVersion: 1 },
          inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
        },
        {
          id: 'test',
          operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 1 },
          inputs: {
            targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
            naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
            modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
            threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
            contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY }
          }
        },
        {
          id: 'proposal-on_save_fail',
          operation: { key: DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
          inputs: {
            targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
            resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
            authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' },
            targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
            amount: { kind: 'LITERAL', value: 1 },
            damageTypeId: { kind: 'LITERAL', value: crypto.randomUUID() }
          }
        }
      ],
      outputs: {
        targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
        naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
        total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
        resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
        contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'contributorChecksum' }
      },
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'proposal-on_save_fail' }]
    } satisfies RuleGraphDefinition
    await base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!row) throw new Error('Fixture Run missing')
      const state = { ...readRunState(row), automationMode }
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state)
      })
      // This internal adapter consumes its parent's validated Scene binding and movement facts.
      await ctx.db.insert('encounterSceneBindings', {
        encounterId: base.run.id,
        campaignId: base.campaign.id,
        sceneId,
        commandId,
        commandFingerprint: checksumCanonicalJson({ sceneId }),
        createdAt: occurredAt
      })
      const loaded = await loadCharacterSheetFacts(
        ctx,
        base.owner.userId,
        base.character.id,
        base.campaign.id
      )
      if (!loaded) throw new Error('Fixture Character missing')
      const runtime = await createRulesRuntime(ctx, base.owner.userId)
      const prepared = await runtime.executeResolvedWithGraph?.({
        command: {
          definitionId,
          occurrenceId,
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: base.actor.id,
            [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
            [DND5E_SAVE_DC_FACT_KEY]: 30,
            [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
              targetActorId: base.actor.id,
              currentHitPoints: base.actor.currentHitPoints,
              temporaryHitPoints: base.actor.tempHitPoints,
              maximumHitPoints: base.actor.maxHitPoints,
              conditionIds: []
            })
          }
        },
        published: serverPublishedRuleDefinitionDtoSchema.parse({
          id: definitionId,
          gameSystemId: base.run.gameSystemId,
          definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
          checksum: checksumRuleDocument(graph),
          definition: graph
        })
      })
      if (!prepared) throw new Error('Frozen compilation missing')
      const scope = await createSpatialRuleEffectStore(ctx).scope({
        encounterId: base.run.id,
        sceneId
      })
      await scope!.create({
        id: effectId,
        definition: activeRuleEffectDefinitionDtoSchema.parse({
          schemaVersion: 1,
          origin: {
            kind: 'ENCOUNTER',
            sourceAggregateId: base.run.id,
            sourceOccurrenceId: occurrenceId,
            rootCommandId: commandId,
            sourceActorId: null
          },
          authoredEffectId: definitionId,
          compiledEntryId: entryId,
          frozenGraphNodeId: 'proposal-on_save_fail',
          frozenGraph: prepared.graph,
          adapterFacts: {
            [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
              loaded.ruleEvaluation.facts.abilityDefinitions[0]!.id,
            [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20',
            [DND5E_SAVE_DC_FACT_KEY]: 30
          },
          perceptionContributions: [],
          recurrence: {
            recurrenceStage: 'NONE',
            consumeOnFirstEvent: null,
            endOnEvents: [],
            lifetimeScope: 'ENCOUNTER',
            expiration: { kind: 'INDEFINITE' }
          }
        }),
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        spatialState: { schemaVersion: 1, revealed: true },
        placement: {
          schemaVersion: 1,
          anchorKind: 'FIXED',
          sourceTokenId: null,
          geometry: {
            frame: 'SCENE_ABSOLUTE',
            shape: { kind: 'CIRCLE', center: { x: 5, y: 0 }, radius: 1 }
          },
          triggerModes: ['CROSS'],
          movementKinds: ['VOLUNTARY'],
          activation: 'ONE_SHOT',
          visibility: 'PUBLIC',
          revealOnTrigger: false
        }
      })
    })
    const movement: NativeSpatialMovementInput = {
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      sceneId,
      sceneVersion: 0,
      root: {
        commandId,
        commandFingerprint: checksumCanonicalJson({ commandId }),
        initiatorUserId: base.owner.userId,
        correlationId: null,
        encounterId: base.run.id,
        sceneId,
        tokenId,
        expectedEncounterVersion: base.run.version,
        expectedSceneVersion: 0,
        movementKind: 'VOLUNTARY',
        originalPath: [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ]
      },
      actorIdByTokenId: new Map([[tokenId, base.actor.id]]),
      sceneTokens: [{ id: tokenId, width: 1, height: 1, position: { x: 0, y: 0 } }],
      currentPosition: { x: 0, y: 0 },
      occurrenceId,
      executionCommandId: commandId,
      occurredAt
    }
    const current = () =>
      base.owner.caller.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        if (!row) throw new Error('Fixture Run missing')
        const scope = await createSpatialRuleEffectStore(ctx).scope({
          encounterId: base.run.id,
          sceneId
        })
        return {
          actor: await readRunActor(ctx, readRunState(row), base.actor.id),
          effects: await scope!.list()
        }
      })
    if (scenario === 'ASSISTED_PREFIX')
      await base.owner.caller.run(async (ctx) => {
        const scope = await createSpatialRuleEffectStore(ctx).scope({
          encounterId: base.run.id,
          sceneId
        })
        const first = await scope!.get(effectId)
        if (!first) throw new Error('First spatial effect missing')
        await scope!.create({
          id: '00000000-0000-4000-8000-000000000001',
          definition: first.definition,
          lifecycle: first.lifecycle,
          spatialState: first.spatialState,
          placement: {
            ...first.placement,
            geometry: {
              frame: 'SCENE_ABSOLUTE',
              shape: { kind: 'CIRCLE', center: { x: 8, y: 0 }, radius: 1 }
            }
          }
        })
      })
    const before = await current()
    const randomRoll = vi.spyOn(rollRandom, 'nextRollInt')
    const pending = await base.owner.caller.run((ctx) =>
      evaluateNativeSpatialMovement(
        ctx,
        movement,
        automationMode === 'AUTOMATIC' ? 'PREVIEW' : 'COMMIT'
      )
    )
    if (automationMode === 'AUTOMATIC') {
      expect(pending.kind).toBe('TERMINAL')
      if (pending.kind !== 'TERMINAL' || pending.result.status !== 'BATCH_COMPLETE')
        throw new Error('Expected automatic terminal spatial damage')
      expect(randomRoll).toHaveBeenCalledTimes(1)
      expect(await current()).toEqual(before)
      const frozenReactionRemainder = {
        root: {
          ...movement.root,
          originalPath: movement.root.originalPath.map((point) => ({ ...point })),
          currentSceneVersion: 0,
          pathChecksum: checksumRuleDocument(movement.root.originalPath),
          pathStartDistance: 0,
          currentPosition: movement.currentPosition,
          resolutionCommands: []
        },
        spatialSelectionChecksum: pending.selectionChecksum,
        spatialCurrentnessChecksum: pending.currentnessChecksum,
        completedSpatialExecutions: pending.result.executions,
        appliedSpatialPrefix: null,
        completedReactionExecutions: [],
        currentSpatialCandidate: null,
        remainingSpatialCandidates: [],
        reactionTimeline: []
      } satisfies NonNullable<NativeSpatialMovementInput['frozenReactionRemainder']>
      const completed = await base.owner.caller.run((ctx) =>
        evaluateNativeSpatialMovement(ctx, {
          ...movement,
          ...(scenario === 'AUTOMATIC_PREPARED'
            ? { frozenTerminal: pending }
            : { frozenReactionRemainder })
        })
      )
      expect(completed).toEqual(pending)
      expect(randomRoll).toHaveBeenCalledTimes(1)
      const after = await current()
      expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
      expect(after.actor.sourceRevision).toBe(base.actorSourceRevision + 1)
      expect(after.effects).toEqual([])
      return
    }
    expect(pending.kind).toBe('PENDING')
    if (pending.kind !== 'PENDING' || !pending.movementIntent)
      throw new Error('Expected pending movement contact')
    const pendingContext = pending.pendingSnapshot.applicationContext
    if (
      pendingContext.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
      pendingContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
    )
      throw new Error('Expected spatial movement context')
    expect(await current()).toEqual(before)
    const resolutionId = crypto.randomUUID()
    const requestId = pending.pendingSnapshot.request.requestId
    const resume: NativeSpatialMovementInput = {
      ...movement,
      pendingSnapshot: pending.pendingSnapshot,
      occurrenceVersion: 1,
      sceneVersion: 1,
      currentPosition: pending.movementIntent.position,
      executionCommandId: resolutionId,
      resolution: { requestId, kind: 'ENTER_DICE', rawFaces: [1] },
      resolutionCommand: {
        commandId: resolutionId,
        commandFingerprint: checksumCanonicalJson({ resolutionId }),
        actorUserId: base.owner.userId,
        correlationId: null,
        expectedOccurrenceVersion: 0,
        requestId,
        kind: 'ENTER_DICE'
      }
    }
    if (scenario === 'ASSISTED_PREFIX') {
      const prefixInput = { ...resume, interruptAfterPathDistance: 6 }
      const preview = await base.owner.caller.run(async (ctx) => {
        const boundary = await evaluateNativeSpatialMovement(ctx, prefixInput, 'PREVIEW')
        if (boundary.kind !== 'REACTION_BOUNDARY' || !('prefixSettlementPlan' in boundary))
          throw new Error('Expected first spatial prefix boundary')
        const { prefixSettlementPlan: _plan, ...retained } = boundary
        return retained
      })
      expect(await current()).toEqual(before)
      const appliedPrefix = await base.owner.caller.run(async (ctx) => {
        const boundary = await evaluateNativeSpatialMovement(ctx, prefixInput, 'PREVIEW')
        if (boundary.kind !== 'REACTION_BOUNDARY' || !('prefixSettlementPlan' in boundary))
          throw new Error('Expected verified first spatial prefix plan')
        expect(boundary.prefixSettlement).toEqual(preview.prefixSettlement)
        return (await settleNativeSpatialMovementPrefix(boundary.prefixSettlementPlan)).result
      })
      const afterPrefix = await current()
      expect(afterPrefix.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
      expect(afterPrefix.actor.sourceRevision).toBe(base.actorSourceRevision + 1)
      expect(afterPrefix.effects).toHaveLength(1)
      const continuation: NativeSpatialMovementInput = {
        ...movement,
        occurrenceVersion: 1,
        sceneVersion: appliedPrefix.sceneVersion,
        currentPosition: preview.boundaryPosition,
        sceneTokens: movement.sceneTokens.map((token) => ({
          ...token,
          position: preview.boundaryPosition
        })),
        executionCommandId: crypto.randomUUID(),
        interruptAfterPathDistance: 9,
        frozenReactionRemainder: {
          root: {
            ...pendingContext.root,
            currentPosition: preview.boundaryPosition,
            currentSceneVersion: appliedPrefix.sceneVersion,
            pathStartDistance: preview.boundaryDistance,
            resolutionCommands: [...preview.resolutionCommands]
          },
          completedSpatialExecutions: [...preview.completedExecutions],
          appliedSpatialPrefix: appliedPrefix,
          completedReactionExecutions: [],
          currentSpatialCandidate: null,
          remainingSpatialCandidates: [...preview.preparedBoundary.remainingCandidates],
          reactionTimeline: [],
          spatialSelectionChecksum: preview.selectionChecksum,
          spatialCurrentnessChecksum: preview.preparedBoundary.currentnessChecksum
        }
      }
      const next = await base.owner.caller.run((ctx) =>
        evaluateNativeSpatialMovement(ctx, continuation, 'PREVIEW')
      )
      if (
        next.kind !== 'PENDING' ||
        !next.movementIntent ||
        next.pendingSnapshot.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
      )
        throw new Error('Expected Assisted evidence after the applied prefix')
      expect(next.pendingSnapshot.applicationContext).toMatchObject({
        phase: { kind: 'SPATIAL_EVIDENCE', currentCandidate: { ordinal: 1 } },
        appliedSpatialPrefix: appliedPrefix,
        completedSpatialExecutions: preview.completedExecutions
      })
      expect(await current()).toEqual(afterPrefix)
      const secondCommandId = crypto.randomUUID()
      const secondRequestId = next.pendingSnapshot.request.requestId
      const secondResume: NativeSpatialMovementInput = {
        ...movement,
        occurrenceVersion: 2,
        sceneVersion: next.pendingSnapshot.applicationContext.root.currentSceneVersion,
        currentPosition: next.movementIntent.position,
        sceneTokens: movement.sceneTokens.map((token) => ({
          ...token,
          position: next.movementIntent!.position
        })),
        executionCommandId: secondCommandId,
        interruptAfterPathDistance: 9,
        pendingSnapshot: next.pendingSnapshot,
        resolution: { requestId: secondRequestId, kind: 'ENTER_DICE', rawFaces: [1] },
        resolutionCommand: {
          commandId: secondCommandId,
          commandFingerprint: checksumCanonicalJson({ secondCommandId }),
          actorUserId: base.owner.userId,
          correlationId: null,
          expectedOccurrenceVersion: 1,
          requestId: secondRequestId,
          kind: 'ENTER_DICE'
        }
      }
      await expect(
        base.owner.caller.run(async (ctx) => {
          await createActiveRuleEffectStore(ctx).create({
            id: crypto.randomUUID(),
            owner: { kind: 'CHARACTER', characterId: base.character.id },
            definition: before.effects[0]!.definition,
            lifecycle: before.effects[0]!.lifecycle
          })
          await evaluateNativeSpatialMovement(ctx, secondResume, 'PREVIEW')
        })
      ).rejects.toThrow('current spatial contact is stale')
      expect(await current()).toEqual(afterPrefix)
      const later = await base.owner.caller.run(async (ctx) => {
        const boundary = await evaluateNativeSpatialMovement(ctx, secondResume, 'PREVIEW')
        if (boundary.kind !== 'REACTION_BOUNDARY' || !('prefixSettlementPlan' in boundary))
          throw new Error('Expected a later reaction boundary after Assisted evidence')
        expect(boundary.appliedPrefix).toEqual(appliedPrefix)
        expect(boundary.prefixSettlementPlan.executions.map((entry) => entry.ordinal)).toEqual([1])
        const { prefixSettlementPlan: _plan, ...retained } = boundary
        return retained
      })
      expect(later.completedExecutions.map((entry) => entry.ordinal)).toEqual([0, 1])
      expect(await current()).toEqual(afterPrefix)
      await expect(
        base.owner.caller.run(async (ctx) => {
          const boundary = await evaluateNativeSpatialMovement(ctx, secondResume, 'PREVIEW')
          if (boundary.kind !== 'REACTION_BOUNDARY' || !('prefixSettlementPlan' in boundary))
            throw new Error('Expected second settlement plan')
          await settleNativeSpatialMovementPrefix(boundary.prefixSettlementPlan)
          throw new Error('Rollback second spatial publication')
        })
      ).rejects.toThrow('Rollback second spatial publication')
      expect(await current()).toEqual(afterPrefix)
      await base.owner.caller.run(async (ctx) => {
        const boundary = await evaluateNativeSpatialMovement(ctx, secondResume, 'PREVIEW')
        if (boundary.kind !== 'REACTION_BOUNDARY' || !('prefixSettlementPlan' in boundary))
          throw new Error('Expected second settlement plan')
        expect(
          (await settleNativeSpatialMovementPrefix(boundary.prefixSettlementPlan)).result
        ).toEqual(later.prefixSettlement)
      })
      const after = await current()
      expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 2)
      expect(after.actor.sourceRevision).toBe(base.actorSourceRevision + 2)
      expect(after.effects).toEqual([])
      expect(randomRoll).not.toHaveBeenCalled()
      return
    }
    await expect(
      base.owner.caller.run((ctx) =>
        evaluateNativeSpatialMovement(ctx, { ...resume, sceneVersion: 2 })
      )
    ).rejects.toThrow('stale')
    expect(await current()).toEqual(before)
    await expect(
      base.owner.caller.run(async (ctx) => {
        await createActiveRuleEffectStore(ctx).create({
          id: crypto.randomUUID(),
          owner: { kind: 'CHARACTER', characterId: base.character.id },
          definition: before.effects[0]!.definition,
          lifecycle: before.effects[0]!.lifecycle
        })
        await evaluateNativeSpatialMovement(ctx, resume)
      })
    ).rejects.toThrow('current spatial contact is stale')
    expect(await current()).toEqual(before)
    const preview = await base.owner.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, resume, 'PREVIEW')
    )
    expect(await current()).toEqual(before)
    const completed = await base.owner.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, resume)
    )
    expect(completed).toEqual(preview)
    expect(completed).toMatchObject({
      kind: 'TERMINAL',
      result: {
        executions: [{ d20: { rawFaces: [1] } }],
        characterTransitions: [
          {
            beforeStreamVersion: base.actorSourceRevision,
            afterStreamVersion: base.actorSourceRevision + 1
          }
        ]
      }
    })
    const after = await current()
    expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
    expect(after.actor.sourceRevision).toBe(base.actorSourceRevision + 1)
    expect(after.effects).toEqual([])
  },
  60000
)
