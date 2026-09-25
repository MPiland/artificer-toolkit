import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MutationCtx } from '../_generated/server'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createSpatialPreparationFixture } from '../../tests/fixtures/spatialPreparation'
import { createRulesRuntime } from '../rules/runtime'
import { internal } from '../_generated/api'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import * as random from '../lib/rollRandom'
import { readCharacterRecord } from '../characters/stateDocuments'
import { characterProjectionState } from './characterStates'
import { readRunActors, readRunState } from './documents'
import { loadMovementTargets } from './movementTargets'
import { prepareNativeTurnEffects, persistNativeTurnEffects } from './turnEffects'
import { resolveNativeTurnEffectPerception } from './turnEffectPerception'
import {
  seedTurnSaveEffect,
  turnActiveEffectFixture
} from '../../tests/fixtures/turnActiveEffectFixtures'

const occurredAt = '2026-09-14T12:00:00.000Z'
const conditionId = srdSystemRecord.conditionTypes.find((value) => value.code === 'FRIGHTENED')!.id
const abilityId = srdSystemRecord.abilities!.find((value) => value.code === 'DEXTERITY')!.id
type EmptyPolicy = 'V1' | 'TERMINATE_WHEN_EMPTY' | 'RETAIN_UNTIL_TERMINAL'

async function current(ctx: MutationCtx, encounterId: string) {
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!row) throw new Error('Missing fixture Run.')
  const state = readRunState(row)
  return { state, actors: await readRunActors(ctx, state) }
}

async function storedCharacter(ctx: MutationCtx, characterId: string) {
  const row = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', characterId))
    .unique()
  if (!row) throw new Error('Missing fixture Character.')
  const { current, temporary, maximum } = characterProjectionState(
    readCharacterRecord(row),
    row.maximumHitPoints,
    srdSystemRecord.conditionTypes
  )
  return { streamVersion: row.streamVersion, hitPoints: { current, temporary, maximum } }
}

function root(state: EncounterRunState, userId: string, actorId: string): TurnCoordinatorRootDto {
  return {
    rootCommandId: crypto.randomUUID(),
    commandFingerprint: checksumCanonicalJson('turn'),
    commandType: state.status === 'PREPARED' ? 'START' : 'ADVANCE_TURN',
    initiatorUserId: userId,
    correlationId: null,
    expectedEncounterVersion: state.version,
    startSystemId: null,
    frozenActorRuleRevisionId: null,
    frozenActorRuleRevisionChecksum: null,
    frozenActorRuleSnapshotChecksum: null,
    initiative: null,
    initiativeAdvance: null,
    proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: actorId },
    resolutionCommands: []
  }
}

async function seed(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    userId: string
    stage?: 'START_OF_TURN' | 'END_OF_TURN'
    ticks?: number
    save?: boolean
    condition?: boolean
    baseline?: boolean
    perception?: boolean
    sourceActorId?: string
  }
) {
  const id = crypto.randomUUID()
  const entry = crypto.randomUUID()
  const stage = input.stage ?? 'START_OF_TURN'
  const repeat = input.save && input.condition
  const nodeId = repeat ? 'test' : input.save ? 'proposal-on_save_fail' : 'proposal'
  const graph: RuleGraphDefinition = {
    schemaVersion: 1,
    id,
    gameSystemId: input.state.gameSystemId,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...(input.save
        ? [
            {
              id: 'd20',
              operation: { key: 'evidence.integer-range', contractVersion: 1 },
              inputs: {
                min: { kind: 'LITERAL' as const, value: 1 },
                max: { kind: 'LITERAL' as const, value: 20 }
              }
            },
            {
              id: 'test',
              operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 1 },
              inputs: {
                targetActorId: { kind: 'FACT' as const, factKey: DND5E_TARGET_ACTOR_FACT_KEY },
                naturalD20: { kind: 'NODE_OUTPUT' as const, nodeId: 'd20', port: 'value' },
                modifier: { kind: 'FACT' as const, factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
                threshold: { kind: 'FACT' as const, factKey: DND5E_SAVE_DC_FACT_KEY },
                contributorChecksum: {
                  kind: 'FACT' as const,
                  factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
                }
              }
            }
          ]
        : []),
      {
        id: nodeId,
        operation: {
          key: input.save
            ? DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY
            : input.condition
              ? DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY
              : DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
          ...(input.condition
            ? {
                conditionId: { kind: 'LITERAL' as const, value: conditionId },
                conditionImmune: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
                }
              }
            : { amount: { kind: 'LITERAL' as const, value: 1 } }),
          ...(input.save
            ? {
                resolvedPath: { kind: 'NODE_OUTPUT' as const, nodeId: 'test', port: 'resultPath' },
                authoredPath: { kind: 'LITERAL' as const, value: 'ON_SAVE_FAIL' }
              }
            : input.condition
              ? {}
              : { damageTypeId: { kind: 'LITERAL' as const, value: crypto.randomUUID() } })
        }
      }
    ],
    outputs: input.save
      ? {
          targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
          total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
          resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
          contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'contributorChecksum' }
        }
      : { targetActorId: { kind: 'NODE_OUTPUT', nodeId, port: 'targetActorId' } },
    sourceEntryBindings: [{ sourceEntryId: entry, nodeId }]
  }
  if (repeat) {
    graph.nodes = [
      { ...graph.nodes[0]!, id: 'repeat-save-d20' },
      {
        ...graph.nodes[1]!,
        inputs: {
          ...graph.nodes[1]!.inputs,
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'repeat-save-d20', port: 'value' },
          threshold: { kind: 'LITERAL', value: 10 }
        }
      }
    ]
  }
  const hitPoints =
    input.actor.kind === 'CHARACTER'
      ? (await storedCharacter(ctx, input.actor.sourceId)).hitPoints
      : {
          current: input.actor.currentHitPoints,
          temporary: input.actor.tempHitPoints,
          maximum: input.actor.maxHitPoints
        }
  const runtime = await createRulesRuntime(ctx, input.userId)
  const compiled = await runtime.executeResolvedWithGraph!({
    command: {
      definitionId: id,
      occurrenceId: crypto.randomUUID(),
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: input.actor.id,
        [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
          targetActorId: input.actor.id,
          currentHitPoints: hitPoints.current,
          temporaryHitPoints: hitPoints.temporary,
          maximumHitPoints: hitPoints.maximum,
          conditionIds: []
        }),
        [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
        [DND5E_SAVE_DC_FACT_KEY]: 10,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
        [DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY]: false
      }
    },
    published: serverPublishedRuleDefinitionDtoSchema.parse({
      id,
      gameSystemId: input.state.gameSystemId,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      checksum: checksumRuleDocument(graph),
      definition: graph
    })
  })
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: input.condition ? 2 : 1,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.state.id,
      sourceOccurrenceId: crypto.randomUUID(),
      rootCommandId: crypto.randomUUID(),
      sourceActorId: input.sourceActorId ?? input.actor.id
    },
    authoredEffectId: id,
    compiledEntryId: entry,
    frozenGraphNodeId: nodeId,
    frozenGraph: compiled.graph,
    adapterFacts: input.save
      ? {
          [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: abilityId,
          [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: repeat ? 'repeat-save-d20' : 'd20',
          [DND5E_SAVE_DC_FACT_KEY]: 10,
          ...(repeat ? { 'dnd5e.active-effect-repeat-save-condition-id': conditionId } : {}),
          ...(input.perception
            ? {
                [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ROLL_INFLUENCE_FACT_KEY]: 'ADVANTAGE',
                [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_PERCEPTION_REQUIREMENT_FACT_KEY]: 'SEE'
              }
            : {})
        }
      : {},
    perceptionContributions: [],
    ...(input.condition
      ? {
          stateContributions: [
            { kind: 'CONDITION_OWNERSHIP', conditionId, baselinePresent: input.baseline ?? false }
          ]
        }
      : {}),
    recurrence: {
      recurrenceStage: stage,
      consumeOnFirstEvent: null,
      endOnEvents: [],
      lifetimeScope: input.actor.kind === 'CHARACTER' ? 'OWNER' : 'ENCOUNTER',
      expiration: { kind: 'TICKS', initialRemaining: input.ticks ?? 2, decrementStage: stage }
    }
  })
  return createActiveRuleEffectStore(ctx).create({
    id: crypto.randomUUID(),
    owner:
      input.actor.kind === 'CHARACTER'
        ? { kind: 'CHARACTER', characterId: input.actor.sourceId! }
        : { kind: 'ENCOUNTER_ACTOR', encounterId: input.state.id, targetActorId: input.actor.id },
    definition,
    lifecycle: { schemaVersion: 1, remainingTicks: input.ticks ?? 2 }
  })
}

async function attachMaintainedState(
  ctx: MutationCtx,
  encounterId: string,
  effect: ActiveRuleEffectRecord,
  policy: EmptyPolicy,
  sourceOccurrenceId = effect.definition.origin.kind === 'ENCOUNTER'
    ? effect.definition.origin.sourceOccurrenceId
    : crypto.randomUUID()
) {
  if (
    effect.owner.kind !== 'ENCOUNTER_ACTOR' ||
    effect.definition.origin.kind !== 'ENCOUNTER' ||
    effect.definition.origin.sourceActorId === null
  )
    throw new Error('Expected an Encounter-actor effect with a source actor.')
  const descriptor = {
    maintenanceDefinitionId: crypto.randomUUID(),
    definitionChecksum: 'b'.repeat(64),
    sourceActionId: crypto.randomUUID(),
    sourceOccurrenceId,
    sourceActorId: effect.definition.origin.sourceActorId,
    replacementPolicy: 'REPLACE_SAME_DEFINITION' as const
  }
  const state = await createActiveRuleEffectStore(ctx).createMaintainedState({
    id: crypto.randomUUID(),
    encounterId,
    ownerActorId: descriptor.sourceActorId,
    descriptor:
      policy === 'V1'
        ? { ...descriptor, schemaVersion: 1 }
        : { ...descriptor, schemaVersion: 2, emptyDependentPolicy: policy }
  })
  const row = await ctx.db
    .query('encounterActiveRuleEffects')
    .withIndex('by_publicId', (q) => q.eq('id', effect.id))
    .unique()
  if (!row) throw new Error('Maintained test effect is unavailable.')
  await ctx.db.patch(row._id, { maintainedEffectStateId: state.id })
  return state
}

async function fixture(assisted = false) {
  const base = await setupCreatureReactionRun()
  const input = await base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    const state = { ...readRunState(row), automationMode: 'ASSISTED' as const }
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
    const actors = await readRunActors(ctx, state)
    const actor = actors.find((value) => value.id === base.reactor.id)!
    if (actor.kind === 'CHARACTER') throw new Error('Expected a Creature reactor.')
    return {
      state,
      actors,
      actor,
      root: root(state, base.owner.userId, actor.id),
      occurrenceId: crypto.randomUUID(),
      userId: base.owner.userId,
      autoRoll: !assisted,
      boundary: { ordinal: 1 as const, stage: 'START_OF_TURN' as const, actorId: actor.id }
    }
  })
  return { ...base, input }
}

async function records(ctx: MutationCtx, encounterId: string) {
  return {
    ...(await current(ctx, encounterId)),
    effects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', encounterId))
      .take(129),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').take(129),
    characterReceipts: await ctx.db.query('characterCommandReceipts').take(129),
    maintainedStates: await ctx.db.query('encounterMaintainedEffectStates').take(129),
    occurrences: await ctx.db.query('encounterRuleOccurrences').take(129),
    commands: await ctx.db.query('encounterRunCommands').take(129)
  }
}

afterEach(() => vi.restoreAllMocks())

describe('native turn effect planning and terminal transactions', () => {
  it('stages grouped Creature ticks and commits lifecycle and mechanics without advancing the Run', async () => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      await seed(ctx, base.input)
      await seed(ctx, { ...base.input, ticks: 1 })
      const before = await records(ctx, base.run.id)
      const unrelatedTargets = await loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.input.state.version,
        targetActorIds: [base.mover.id]
      })
      const prepared = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        movementTargets: unrelatedTargets
      })
      expect(await records(ctx, base.run.id)).toEqual(before)
      if (prepared.kind !== 'COMPLETE' || !prepared.plan) throw new Error('Expected completion.')
      const damaged = prepared.actors.find((actor) => actor.id === base.input.actor.id)
      if (!damaged || damaged.kind === 'CHARACTER')
        throw new Error('Expected the Creature reactor.')
      expect(damaged.currentHitPoints).toBe(base.input.actor.currentHitPoints - 2)
      const applied = await persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: prepared.plan
      })
      expect(applied.actors[0]).toEqual(
        prepared.actors.find((actor) => actor.id === base.input.actor.id)
      )
      const after = await records(ctx, base.run.id)
      expect(after.effects).toHaveLength(1)
      expect(after.effects[0]?.lifecycle.remainingTicks).toBe(1)
      expect(after.state).toEqual(before.state)
      expect(after.commands).toEqual(before.commands)
      expect(after.occurrences).toEqual(before.occurrences)
    })
  }, 30000)

  it.each([
    ['V1', true],
    ['TERMINATE_WHEN_EMPTY', true],
    ['RETAIN_UNTIL_TERMINAL', false]
  ] as const)('applies maintained final-dependent policy %s', async (policy, terminates) => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      const effect = await seed(ctx, { ...base.input, ticks: 1 })
      const state = await attachMaintainedState(ctx, base.run.id, effect, policy)
      const prepared = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (prepared.kind !== 'COMPLETE' || !prepared.plan)
        throw new Error('Expected maintained completion.')
      const settled = await persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: prepared.plan
      })
      if (
        settled.result?.status !== 'BATCH_COMPLETE' ||
        settled.result.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      )
        throw new Error('Expected maintained turn receipt.')
      expect(settled.result.terminatedMaintainedStates).toEqual(
        terminates
          ? [
              {
                id: state.id,
                ownerActorId: state.ownerActorId,
                maintenanceDefinitionId: state.maintenanceDefinitionId,
                expectedVersion: state.version,
                descriptorChecksum: state.descriptorChecksum
              }
            ]
          : undefined
      )
      expect(
        await createActiveRuleEffectStore(ctx).findMaintainedStateById({
          encounterId: base.run.id,
          stateId: state.id
        })
      ).toEqual(terminates ? null : expect.objectContaining({ id: state.id }))
    })
  })

  it.each(['missing', 'source'] as const)(
    'rejects a maintained %s binding before requesting evidence',
    async (change) => {
      const base = await fixture(true)
      await base.owner.caller.run(async (ctx) => {
        const effect = await seed(ctx, { ...base.input, save: true, ticks: 1 })
        const state = await attachMaintainedState(
          ctx,
          base.run.id,
          effect,
          'TERMINATE_WHEN_EMPTY',
          change === 'source' ? crypto.randomUUID() : undefined
        )
        if (change === 'missing') {
          const row = await ctx.db
            .query('encounterMaintainedEffectStates')
            .withIndex('by_encounterId_id', (q) =>
              q.eq('encounterId', base.run.id).eq('id', state.id)
            )
            .unique()
          if (!row) throw new Error('Maintained test state is unavailable.')
          await ctx.db.delete(row._id)
        }
        const roll = vi.spyOn(random, 'nextRollInt')
        await expect(prepareNativeTurnEffects({ ctx, ...base.input })).rejects.toThrow(
          'Maintained turn effect source binding is stale.'
        )
        expect(roll).not.toHaveBeenCalled()
      })
    }
  )

  it('revalidates maintained state before terminal settlement', async () => {
    const base = await fixture()
    const prepared = await base.owner.caller.run(async (ctx) => {
      const effect = await seed(ctx, { ...base.input, ticks: 1 })
      const state = await attachMaintainedState(ctx, base.run.id, effect, 'TERMINATE_WHEN_EMPTY')
      const result = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (result.kind !== 'COMPLETE' || !result.plan)
        throw new Error('Expected maintained completion.')
      const row = await ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', state.id))
        .unique()
      if (!row) throw new Error('Maintained test state is unavailable.')
      await ctx.db.delete(row._id)
      return result.plan
    })
    const before = await base.owner.caller.run((ctx) => records(ctx, base.run.id))
    await expect(
      base.owner.caller.run((ctx) =>
        persistNativeTurnEffects(ctx, {
          ...base.input,
          rootCommandId: base.input.root.rootCommandId,
          occurrenceVersion: 1,
          occurredAt,
          plan: prepared
        })
      )
    ).rejects.toThrow('Maintained turn effect source binding is stale.')
    expect(await base.owner.caller.run((ctx) => records(ctx, base.run.id))).toEqual(before)
  }, 30000)

  it('retains maintained state for surviving same-owner and other-owner dependents and rolls back atomically', async () => {
    const base = await fixture()
    const seeded = await base.owner.caller.run(async (ctx) => {
      const effect = await seed(ctx, { ...base.input, ticks: 1 })
      const state = await attachMaintainedState(ctx, base.run.id, effect, 'TERMINATE_WHEN_EMPTY')
      const store = createActiveRuleEffectStore(ctx)
      const siblingDefinition = activeRuleEffectDefinitionDtoSchema.parse({
        ...effect.definition,
        recurrence: {
          ...effect.definition.recurrence,
          expiration: {
            kind: 'TICKS',
            initialRemaining: 2,
            decrementStage: base.input.boundary.stage
          }
        }
      })
      const sibling = await store.create({
        id: crypto.randomUUID(),
        owner: effect.owner,
        definition: siblingDefinition,
        lifecycle: { schemaVersion: 1, remainingTicks: 2 },
        maintainedEffectStateId: state.id
      })
      const otherOwner = await store.create({
        id: crypto.randomUUID(),
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: base.run.id,
          targetActorId: base.mover.id
        },
        definition: effect.definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 },
        maintainedEffectStateId: state.id
      })
      return { state, sibling, otherOwner }
    })
    const prepared = await base.owner.caller.run(async (ctx) => {
      const result = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (result.kind !== 'COMPLETE' || !result.plan)
        throw new Error('Expected maintained completion.')
      return result.plan
    })
    const before = await base.owner.caller.run((ctx) => records(ctx, base.run.id))
    await expect(
      base.owner.caller.run(async (ctx) => {
        await persistNativeTurnEffects(ctx, {
          ...base.input,
          rootCommandId: base.input.root.rootCommandId,
          occurrenceVersion: 1,
          occurredAt,
          plan: prepared
        })
        throw new Error('maintained rollback proof')
      })
    ).rejects.toThrow('maintained rollback proof')
    expect(await base.owner.caller.run((ctx) => records(ctx, base.run.id))).toEqual(before)

    const settled = await base.owner.caller.run((ctx) =>
      persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: prepared
      })
    )
    if (
      settled.result?.status !== 'BATCH_COMPLETE' ||
      settled.result.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
    )
      throw new Error('Expected maintained turn receipt.')
    expect(settled.result.terminatedMaintainedStates).toBeUndefined()
    const after = await base.owner.caller.run((ctx) => records(ctx, base.run.id))
    expect(after.maintainedStates).toEqual([expect.objectContaining({ id: seeded.state.id })])
    expect(after.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: seeded.sibling.id, version: 2 }),
        expect.objectContaining({ id: seeded.otherOwner.id, version: 1 })
      ])
    )
  }, 30000)

  it('pauses and reconstructs an Assisted maintained expiry without writes or rerolls', async () => {
    const base = await fixture(true)
    await base.owner.caller.run(async (ctx) => {
      const effect = await seed(ctx, { ...base.input, save: true, ticks: 1 })
      const state = await attachMaintainedState(ctx, base.run.id, effect, 'TERMINATE_WHEN_EMPTY')
      const before = await records(ctx, base.run.id)
      const pending = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (pending.kind !== 'PENDING' || pending.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
        throw new Error('Expected maintained save pause.')
      expect(await records(ctx, base.run.id)).toEqual(before)
      const completed = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        pending: pending.snapshot,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: pending.snapshot.request.requestId,
          rawFaces: [1]
        }
      })
      if (completed.kind !== 'COMPLETE' || !completed.plan)
        throw new Error('Expected maintained save completion.')
      expect(
        await prepareNativeTurnEffects({ ctx, ...base.input, retainedPhase: completed.phase })
      ).toEqual(completed)
      const settled = await persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 2,
        occurredAt,
        plan: completed.plan
      })
      if (
        settled.result?.status !== 'BATCH_COMPLETE' ||
        settled.result.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      )
        throw new Error('Expected maintained turn receipt.')
      expect(settled.result.terminatedMaintainedStates?.map((entry) => entry.id)).toEqual([
        state.id
      ])
      expect((await records(ctx, base.run.id)).maintainedStates).toEqual([])
    })
  }, 30000)

  it('merges Automatic outgoing and incoming maintained cleanup evidence and exactly replays', async () => {
    const base = await turnActiveEffectFixture('AUTO_ROLL')
    const started = await base.owner.caller.mutation(internal.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const outgoing = await seedTurnSaveEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const incoming = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const states = await base.t.run(async (ctx) => [
      await attachMaintainedState(ctx, base.run.id, outgoing, 'TERMINATE_WHEN_EMPTY'),
      await attachMaintainedState(ctx, base.run.id, incoming, 'TERMINATE_WHEN_EMPTY')
    ])
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    }
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((values) => {
      ;(values as Uint32Array)[0] = 0
      return values
    })
    const result = await base.owner.caller.mutation(internal.encounters.commands.execute, advance)
    const terminal = await base.t.run(async (ctx) => ({
      states: await ctx.db.query('encounterMaintainedEffectStates').take(129),
      effects: await ctx.db.query('encounterActiveRuleEffects').take(129),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q.eq('encounterId', base.run.id).eq('commandId', advance.command.commandId)
        )
        .collect()
    }))
    expect(terminal.states).toEqual([])
    expect(terminal.effects).toEqual([])
    const receipt = terminal.receipts[0]
    if (!receipt) throw new Error('Expected maintained turn receipt.')
    const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (stored.status !== 'TURN_LIFECYCLE_COMPLETE')
      throw new Error('Expected complete turn lifecycle receipt.')
    expect(stored.terminatedMaintainedStates).toEqual(
      states
        .map((state) => ({
          id: state.id,
          ownerActorId: state.ownerActorId,
          maintenanceDefinitionId: state.maintenanceDefinitionId,
          expectedVersion: state.version,
          descriptorChecksum: state.descriptorChecksum
        }))
        .sort((left, right) =>
          `${left.ownerActorId}:${left.id}`.localeCompare(`${right.ownerActorId}:${right.id}`)
        )
    )
    entropy.mockClear()
    await expect(
      base.owner.caller.mutation(internal.encounters.commands.execute, advance)
    ).resolves.toEqual(result)
    expect(entropy).not.toHaveBeenCalled()
    expect(
      await base.t.run(async (ctx) => ({
        states: await ctx.db.query('encounterMaintainedEffectStates').take(129),
        effects: await ctx.db.query('encounterActiveRuleEffects').take(129),
        receipts: await ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) =>
            q.eq('encounterId', base.run.id).eq('commandId', advance.command.commandId)
          )
          .collect()
      }))
    ).toEqual(terminal)
  }, 30000)

  it('pauses after a prefix, resumes only its current effect, and reconstructs without rerolling', async () => {
    const base = await fixture(true)
    await base.owner.caller.run(async (ctx) => {
      await seed(ctx, base.input)
      await seed(ctx, { ...base.input, save: true })
      await seed(ctx, { ...base.input, save: true })
      const before = await records(ctx, base.run.id)
      const first = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (first.kind !== 'PENDING' || first.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
        throw new Error('Expected save pause.')
      expect(await records(ctx, base.run.id)).toEqual(before)
      const second = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        pending: first.snapshot,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: first.snapshot.request.requestId,
          rawFaces: [1]
        }
      })
      if (second.kind !== 'PENDING' || second.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
        throw new Error('Expected suffix pause.')
      expect(second.snapshot.applicationContext.kind).toBe('ENCOUNTER_TURN_ACTIVE_EFFECTS')
      if (second.snapshot.applicationContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
        expect(second.snapshot.applicationContext.completedExecutions).toHaveLength(2)
      const roll = vi.spyOn(random, 'nextRollInt').mockReturnValue(0)
      const completed = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        pending: second.snapshot,
        resolution: { kind: 'SYSTEM_ROLL', requestId: second.snapshot.request.requestId }
      })
      if (completed.kind !== 'COMPLETE' || !completed.plan)
        throw new Error('Expected completed saves.')
      expect(roll).toHaveBeenCalledTimes(1)
      const restored = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        retainedPhase: completed.phase
      })
      expect(restored).toEqual(completed)
      await persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 3,
        occurredAt,
        plan: completed.plan
      })
      expect(roll).toHaveBeenCalledTimes(1)
    })
  }, 30000)

  it.each(['version', 'definition', 'target', 'suffix', 'missing'] as const)(
    'rejects stale %s before consuming a system roll',
    async (change) => {
      const base = await fixture(true)
      await base.owner.caller.run(async (ctx) => {
        const first = await seed(ctx, { ...base.input, save: true })
        const suffix = await seed(ctx, base.input)
        const prepared = await prepareNativeTurnEffects({ ctx, ...base.input })
        if (prepared.kind !== 'PENDING' || prepared.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
          throw new Error('Expected save pause.')
        const effectId = change === 'suffix' ? suffix.id : first.id
        const effect = await ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_publicId', (q) => q.eq('id', effectId))
          .unique()
        if (!effect) throw new Error('Missing effect.')
        if (change === 'version' || change === 'suffix')
          await ctx.db.patch(effect._id, { version: effect.version + 1 })
        if (change === 'missing') await ctx.db.delete(effect._id)
        if (change === 'definition') {
          const definition = { ...first.definition, authoredEffectId: crypto.randomUUID() }
          await ctx.db.patch(effect._id, {
            definitionJson: JSON.stringify(definition),
            definitionChecksum: checksumCanonicalJson(definition)
          })
        }
        if (change === 'target') {
          const row = await ctx.db
            .query('encounterRunActors')
            .withIndex('by_encounterId_id', (q) =>
              q.eq('encounterId', base.run.id).eq('id', base.input.actor.id)
            )
            .unique()
          if (!row) throw new Error('Missing actor.')
          const actor = {
            ...base.input.actor,
            currentHitPoints: base.input.actor.currentHitPoints - 1
          }
          await ctx.db.patch(row._id, {
            stateJson: JSON.stringify(actor),
            stateChecksum: checksumCanonicalJson(actor)
          })
        }
        const roll = vi.spyOn(random, 'nextRollInt')
        await expect(
          prepareNativeTurnEffects({
            ctx,
            ...base.input,
            ...(await current(ctx, base.run.id)),
            pending: prepared.snapshot,
            resolution: { kind: 'SYSTEM_ROLL', requestId: prepared.snapshot.request.requestId }
          })
        ).rejects.toThrow()
        expect(roll).not.toHaveBeenCalled()
      })
    },
    30000
  )

  it('rejects complete receipt tampering and rolls back a failed terminal transaction', async () => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      await seed(ctx, base.input)
    })
    const prepared = await base.owner.caller.run(async (ctx) => {
      const result = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (result.kind !== 'COMPLETE' || !result.plan) throw new Error('Expected completion.')
      return { plan: result.plan }
    })
    const before = await base.owner.caller.run((ctx) => records(ctx, base.run.id))
    for (const change of ['applications', 'lifecycle', 'checksum', 'binding'] as const) {
      const plan = structuredClone(prepared.plan)
      if (change === 'applications') plan.executions[0]!.applications = []
      else if (change === 'lifecycle') plan.executions[0]!.lifecycle.beforeRemainingTicks = 99
      else if (change === 'binding')
        plan.executions[0]!.execution.evidence.sourceEntryBindings = [
          ...(plan.executions[0]!.execution.evidence.sourceEntryBindings ?? []),
          { sourceEntryId: crypto.randomUUID(), nodeId: 'unbound' }
        ]
      else plan.executions[0]!.targetTransition.checksum = '0'.repeat(64)
      await expect(
        base.owner.caller.run((ctx) =>
          persistNativeTurnEffects(ctx, {
            ...base.input,
            rootCommandId: base.input.root.rootCommandId,
            occurrenceVersion: 1,
            occurredAt,
            plan
          })
        )
      ).rejects.toThrow()
    }
    await expect(
      base.owner.caller.run(async (ctx) => {
        await persistNativeTurnEffects(ctx, {
          ...base.input,
          rootCommandId: base.input.root.rootCommandId,
          occurrenceVersion: 1,
          occurredAt,
          plan: prepared.plan
        })
        throw new Error('terminal rollback proof')
      })
    ).rejects.toThrow('terminal rollback proof')
    expect(await base.owner.caller.run((ctx) => records(ctx, base.run.id))).toEqual(before)
  }, 30000)

  it('overlays outgoing expiration before the same actor starts its next turn', async () => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      await seed(ctx, { ...base.input, stage: 'END_OF_TURN', ticks: 1 })
      await seed(ctx, base.input)
      const outgoing = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        boundary: { ...base.input.boundary, ordinal: 0, stage: 'END_OF_TURN' }
      })
      if (outgoing.kind !== 'COMPLETE') throw new Error('Expected outgoing completion.')
      const incoming = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        actors: outgoing.actors,
        boundary: { ...base.input.boundary, ordinal: 1 },
        movementTargets: outgoing.movementTargets,
        priorPlan: outgoing.phase
      })
      if (incoming.kind !== 'COMPLETE') throw new Error('Expected incoming completion.')
      expect(incoming.movementTargets.get(base.input.actor.id)?.activeEffects).toHaveLength(1)
      await persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: outgoing.plan
      })
      const terminal = await persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: incoming.plan
      })
      expect(terminal.actors[0]).toEqual(
        incoming.actors.find((actor) => actor.id === base.input.actor.id)
      )
    })
  }, 30000)

  it('projects and commits Character HP with exactly one stream advance per phase', async () => {
    const base = await setupCharacterRun()
    await base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!row) throw new Error('Missing Character Run.')
      const active = { ...readRunState(row), status: 'ACTIVE' as const }
      await ctx.db.patch(row._id, {
        status: 'ACTIVE',
        stateJson: JSON.stringify(active),
        stateChecksum: checksumCanonicalJson(active)
      })
      const facts = await current(ctx, base.run.id)
      const input = {
        ...facts,
        actor: facts.actors.find((actor) => actor.id === base.actor.id)!,
        root: root(facts.state, base.owner.userId, base.actor.id),
        userId: base.owner.userId,
        autoRoll: true,
        occurrenceId: crypto.randomUUID(),
        boundary: { ordinal: 0 as const, stage: 'END_OF_TURN' as const, actorId: base.actor.id }
      }
      await seed(ctx, { ...input, stage: 'END_OF_TURN' })
      await seed(ctx, { ...input, stage: 'END_OF_TURN' })
      await seed(ctx, input)
      await seed(ctx, input)
      const prepared = await prepareNativeTurnEffects({ ctx, ...input })
      if (prepared.kind !== 'COMPLETE' || !prepared.plan)
        throw new Error('Expected Character completion.')
      const projected = prepared.movementTargets.get(base.actor.id)!
      expect(projected.characterFacts?.active.streamVersion).toBe(base.characterStreamVersion + 1)
      expect(projected.characterFacts?.character.state.hitpoints.current).toBe(
        projected.state.current
      )
      const incoming = await prepareNativeTurnEffects({
        ctx,
        ...input,
        actors: prepared.actors,
        movementTargets: prepared.movementTargets,
        priorPlan: prepared.phase,
        boundary: { ordinal: 1, stage: 'START_OF_TURN', actorId: base.actor.id }
      })
      if (incoming.kind !== 'COMPLETE' || !incoming.plan)
        throw new Error('Expected Character incoming effects.')
      const finalTarget = incoming.movementTargets.get(base.actor.id)!
      expect(finalTarget.characterFacts?.active.streamVersion).toBe(base.characterStreamVersion + 2)
      const settled = await persistNativeTurnEffects(ctx, {
        ...input,
        rootCommandId: input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: prepared.plan
      })
      expect(settled.actors[0]).toEqual(projected.actor)
      const final = await persistNativeTurnEffects(ctx, {
        ...input,
        rootCommandId: input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: incoming.plan
      })
      expect(final.actors[0]).toEqual(finalTarget.actor)
      expect(await storedCharacter(ctx, base.character.id)).toEqual({
        streamVersion: base.characterStreamVersion + 2,
        hitPoints: {
          current: finalTarget.state.current,
          temporary: finalTarget.state.temporary,
          maximum: base.actor.maxHitPoints
        }
      })
      const loaded = (
        await loadMovementTargets(ctx, {
          encounterId: base.run.id,
          expectedEncounterVersion: facts.state.version,
          targetActorIds: [base.actor.id]
        })
      ).get(base.actor.id)!
      expect(finalTarget.characterCurrentness).toEqual(loaded.characterCurrentness)
      expect(finalTarget.targetDerivedFacts).toEqual(loaded.targetDerivedFacts)
      expect((await records(ctx, base.run.id)).characterReceipts).toHaveLength(2)
    })
  }, 30000)

  it('retains Manual reminders without loading target mechanics', async () => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      await seed(ctx, base.input)
      const prepared = await prepareNativeTurnEffects({
        ctx,
        ...base.input,
        state: { ...base.input.state, automationMode: 'MANUAL' }
      })
      if (prepared.kind !== 'COMPLETE') throw new Error('Expected Manual completion.')
      expect(prepared.phase.kind).toBe('MANUAL')
      expect(prepared.movementTargets.size).toBe(0)
      expect(prepared.plan).toBeNull()
    })
  }, 30000)

  it.each([
    { baseline: false, ticks: 1, face: 0 },
    { baseline: true, ticks: 1, face: 0 },
    { baseline: false, ticks: 2, face: 19 }
  ])(
    'expires repeated saves with shared ownership: %j',
    async ({ baseline, ticks, face }) => {
      const base = await fixture()
      await base.owner.caller.run(async (ctx) => {
        const actor = { ...base.input.actor, conditions: [{ conditionTypeId: conditionId }] }
        const row = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', actor.id)
          )
          .unique()
        if (!row) throw new Error('Missing condition target.')
        await ctx.db.patch(row._id, {
          stateJson: JSON.stringify(actor),
          stateChecksum: checksumCanonicalJson(actor)
        })
        const input = { ...base.input, ...(await current(ctx, base.run.id)), actor }
        await seed(ctx, { ...input, save: true, condition: true, ticks, baseline })
        await seed(ctx, { ...input, save: true, condition: true, ticks, baseline })
        vi.spyOn(random, 'nextRollInt').mockReturnValue(face)
        const prepared = await prepareNativeTurnEffects({ ctx, ...input })
        if (prepared.kind !== 'COMPLETE' || !prepared.plan)
          throw new Error('Expected expired saves.')
        expect(prepared.plan.executions[0]!.targetTransition.after.conditionIds).toContain(
          conditionId
        )
        expect(
          prepared.plan.executions[1]!.targetTransition.after.conditionIds.includes(conditionId)
        ).toBe(baseline)
        const result = await persistNativeTurnEffects(ctx, {
          ...input,
          rootCommandId: input.root.rootCommandId,
          occurrenceVersion: 1,
          occurredAt,
          plan: prepared.plan
        })
        const settled = result.actors[0]
        if (!settled || settled.kind === 'CHARACTER')
          throw new Error('Expected the Creature target.')
        expect(settled.conditions).toEqual(baseline ? [{ conditionTypeId: conditionId }] : [])
        expect((await records(ctx, base.run.id)).effects).toHaveLength(0)
        if (
          result.result?.status !== 'BATCH_COMPLETE' ||
          result.result.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
        )
          throw new Error('Expected turn receipt.')
        for (const tamper of ['node', 'path', 'result', 'lifecycle', 'extra', 'owner'] as const) {
          const forged = structuredClone(result.result)
          const execution = forged.executions[0]!
          const application = execution.applications[0]!
          if (application.kind !== 'CONDITION_REMOVE') throw new Error('Expected owned removal.')
          if (tamper === 'node') application.sourceNodeId = 'forged-save'
          else if (tamper === 'path') application.resolvedPath = 'FORGED_PATH'
          else if (tamper === 'result') {
            if (!execution.d20) throw new Error('Expected save evidence.')
            const path =
              execution.d20.resultPath === 'ON_SAVE_FAIL' ? 'ON_SAVE_SUCCESS' : 'ON_SAVE_FAIL'
            execution.d20.resultPath = path
            execution.execution.outputs.resultPath = path
            execution.execution.evidence.outputs.resultPath = path
            execution.execution.evidence.trace[1]!.outputs.resultPath = path
            application.authoredPath = path
            application.resolvedPath = path
          } else if (tamper === 'owner') application.sourceActiveEffectId = crypto.randomUUID()
          else if (tamper === 'extra') execution.applications.push({ ...application })
          else
            execution.lifecycle = {
              kind: 'UPDATE',
              expectedVersion: execution.beforeVersion,
              afterVersion: execution.beforeVersion + 1,
              beforeRemainingTicks: 2,
              afterRemainingTicks: 1,
              beforeLifecycleChecksum: execution.lifecycle.beforeLifecycleChecksum,
              afterLifecycleChecksum: checksumRuleDocument({ schemaVersion: 1, remainingTicks: 1 })
            }
          expect(storedRuleExecutionResultDtoSchema.safeParse(forged).success).toBe(false)
        }
      })
    },
    30000
  )

  it('retains a failed nonfinal repeated save without a mechanics application', async () => {
    const base = await fixture()
    await base.owner.caller.run(async (ctx) => {
      await seed(ctx, { ...base.input, save: true, condition: true, ticks: 2 })
      vi.spyOn(random, 'nextRollInt').mockReturnValue(0)
      const prepared = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (prepared.kind !== 'COMPLETE' || !prepared.plan) throw new Error('Expected nonfinal save.')
      expect(prepared.plan.executions[0]?.applications).toEqual([])
      expect(prepared.actors).toEqual(base.input.actors)
      const result = await persistNativeTurnEffects(ctx, {
        ...base.input,
        rootCommandId: base.input.root.rootCommandId,
        occurrenceVersion: 1,
        occurredAt,
        plan: prepared.plan
      })
      expect(result.actors[0]).toEqual(base.input.actor)
      expect((await records(ctx, base.run.id)).effects[0]?.version).toBe(2)
    })
  }, 30000)

  it('resolves current Scene perception and seals missing geometry as unavailable', async () => {
    const value = await createSpatialPreparationFixture()
    const base = value.base
    const invisible = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'INVISIBLE'
    )!.id
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) => definition.id === invisible
      ).map((definition) => ({
        ...definition,
        document: jsonValueSchema.parse(definition.document)
      }))
    })
    await base.other.caller.run(async (ctx) => {
      const facts = await current(ctx, base.run.id)
      const [actor, source] = facts.actors
      if (!actor || !source) throw new Error('Missing Scene actors.')
      if (source.kind === 'CHARACTER') throw new Error('Expected a custom Scene source.')
      for (const [index, target] of [actor, source].entries()) {
        await ctx.db.insert('encounterActorTokenBindings', {
          encounterId: base.run.id,
          actorId: target.id,
          sceneId: base.sceneId,
          tokenId: base.tokens[index]!.id.toLowerCase()
        })
      }
      const effect = await seed(ctx, {
        ...facts,
        actor,
        userId: base.other.userId,
        save: true,
        perception: true,
        sourceActorId: source.id
      })
      const targets = await loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: facts.state.version,
        targetActorIds: [actor.id, source.id]
      })
      const target = targets.get(actor.id)!
      const result = await resolveNativeTurnEffectPerception(ctx, {
        ...facts,
        userId: base.other.userId,
        target,
        targets,
        effect
      })
      expect(result?.satisfied).toBe(true)
      const before = result?.checksum
      const stagedSource = { ...source, conditions: [{ conditionTypeId: invisible }] }
      const staged = await resolveNativeTurnEffectPerception(ctx, {
        ...facts,
        actors: facts.actors.map((value) => (value.id === source.id ? stagedSource : value)),
        userId: base.other.userId,
        target,
        targets: new Map([[actor.id, target]]),
        effect
      })
      expect(staged?.satisfied).toBe(false)
      expect(staged?.checksum).not.toBe(before)
      const storedSource = (await current(ctx, base.run.id)).actors.find(
        (value) => value.id === source.id
      )
      if (!storedSource || storedSource.kind === 'CHARACTER')
        throw new Error('Missing custom Scene source.')
      expect(storedSource.conditions).toEqual(source.conditions)
      const observerBinding = await ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) =>
          q.eq('encounterId', base.run.id).eq('actorId', actor.id)
        )
        .unique()
      if (!observerBinding) throw new Error('Missing observer binding.')
      await ctx.db.delete(observerBinding._id)
      const unavailable = await resolveNativeTurnEffectPerception(ctx, {
        ...facts,
        userId: base.other.userId,
        target,
        targets,
        effect
      })
      expect(unavailable?.satisfied).toBe(false)
      expect(unavailable?.checksum).not.toBe(before)
    })
  }, 30000)

  it('seals unavailable perception without inventing Scene facts', async () => {
    const base = await fixture(true)
    await base.owner.caller.run(async (ctx) => {
      await seed(ctx, {
        ...base.input,
        save: true,
        perception: true,
        sourceActorId: crypto.randomUUID()
      })
      const prepared = await prepareNativeTurnEffects({ ctx, ...base.input })
      if (
        prepared.kind !== 'PENDING' ||
        prepared.snapshot.applicationContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      )
        throw new Error('Expected save pause.')
      expect(prepared.snapshot.applicationContext.currentCandidate.d20Policy?.rollMode).toBe(
        'NORMAL'
      )
    })
  }, 30000)
})
