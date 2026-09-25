import { afterEach, expect, it, vi } from 'vitest'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import * as rollRandom from '../lib/rollRandom'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { createRulesRuntime } from '../rules/runtime'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import { evaluateNativeSpatialMovement, type NativeSpatialMovementInput } from './spatialMovement'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('replays retained SYSTEM_ROLL spatial evidence without random generation', async () => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'native-spatial-test-secret-at-least-32-bytes')
  const base = await setupCharacterRun()
  const sceneId = crypto.randomUUID()
  const tokenId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const occurrenceId = crypto.randomUUID()
  const definitionId = crypto.randomUUID()
  const entryId = crypto.randomUUID()
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
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Fixture Run missing')
    const state = {
      ...encounterRunStateSchema.parse(JSON.parse(run.stateJson)),
      automationMode: 'ASSISTED'
    }
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId,
      commandId,
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: occurredAt
    })
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.owner.userId,
      base.character.id,
      base.campaign.id
    )
    if (!facts) throw new Error('Fixture Character missing')
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
    if (!scope) throw new Error('Fixture Scene binding missing')
    await scope.create({
      id: crypto.randomUUID(),
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
            facts.ruleEvaluation.facts.abilityDefinitions[0]!.id,
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
    occurredAt,
    autoRoll: {}
  }
  const pending = await base.owner.caller.run((ctx) =>
    evaluateNativeSpatialMovement(ctx, movement, 'PREVIEW')
  )
  if (pending.kind !== 'PENDING') throw new Error('Expected pending spatial d20 evidence')
  const requestId = pending.pendingSnapshot.request.requestId
  const resume: NativeSpatialMovementInput = {
    ...movement,
    pendingSnapshot: pending.pendingSnapshot,
    occurrenceVersion: 1,
    sceneVersion: 1,
    currentPosition: pending.movementIntent!.position,
    executionCommandId: crypto.randomUUID(),
    resolution: {
      requestId,
      kind: 'SYSTEM_ROLL',
      rollId: crypto.randomUUID(),
      faces: [1],
      rollMode: 'NORMAL'
    },
    resolutionCommand: {
      commandId: crypto.randomUUID(),
      commandFingerprint: checksumCanonicalJson({ requestId }),
      actorUserId: base.owner.userId,
      correlationId: null,
      expectedOccurrenceVersion: 0,
      requestId,
      kind: 'SYSTEM_ROLL'
    }
  }
  vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(0)
  const prepared = await base.owner.caller.run((ctx) =>
    evaluateNativeSpatialMovement(ctx, resume, 'PREVIEW')
  )
  if (prepared.kind !== 'TERMINAL' || prepared.result.status !== 'BATCH_COMPLETE')
    throw new Error('Expected completed spatial SYSTEM_ROLL preview')
  const retainedExecutions = prepared.result.executions
  const before = await base.owner.caller.run((ctx) =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
  )
  vi.spyOn(rollRandom, 'nextRollInt').mockImplementation(() => {
    throw new Error('Random roll must not run during retained replay')
  })
  const replay = await base.owner.caller.run((ctx) =>
    evaluateNativeSpatialMovement(ctx, { ...resume, retainedExecutions }, 'PREVIEW')
  )
  expect(replay).toEqual(prepared)
  // The answered contact settles with the app roll's recorded faces, never a retained face.
  await expect(
    base.owner.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, { ...resume, retainedExecutions: [] }, 'PREVIEW')
    )
  ).resolves.toEqual(prepared)
  await expect(
    base.owner.caller.run((ctx) =>
      evaluateNativeSpatialMovement(
        ctx,
        {
          ...resume,
          retainedExecutions: [
            ...retainedExecutions,
            ...retainedExecutions.map((execution) => ({
              ...execution,
              ordinal: execution.ordinal + retainedExecutions.length
            }))
          ]
        },
        'PREVIEW'
      )
    )
  ).rejects.toThrow('unused d20 faces')
  await expect(
    base.owner.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, { ...resume, retainedExecutions })
    )
  ).rejects.toThrow('allowed only during preparation preview')
  const after = await base.owner.caller.run((ctx) =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
  )
  expect(after).toEqual(before)
})
