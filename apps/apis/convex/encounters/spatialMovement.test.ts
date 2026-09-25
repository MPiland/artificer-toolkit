import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterSceneBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { evaluateNativeSpatialMovement, type NativeSpatialMovementInput } from './spatialMovement'
import { readRunActor, readRunState } from './documents'
import { seedSpatialEffect as seedEffect } from '../../tests/fixtures/spatialEffect'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import * as movementTargets from './movementTargets'
import type { MovementTarget } from './movementTargets'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  checksumSpatialCurrentness,
  spatialEffectTransition,
  type FrozenMovementReactionRemainder
} from '@artificer-toolkit/rules-runtime/encounterSpatialMovementRuleService'
import { planNativeSpatialMovementPrefix } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPlan'
import { applyEncounterMechanicsBatch } from './mechanicsBatch'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'

beforeEach(() => vi.stubEnv('BETTER_AUTH_SECRET', 'native-spatial-test-secret-at-least-32-bytes'))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const ids = {
  command: '00000000-0000-4000-8000-000000000101',
  occurrence: '00000000-0000-4000-8000-000000000102'
}

async function fixture() {
  const base = await createEncounterSceneFixture()
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run missing')
    const state = { ...readRunState(row), automationMode: 'ASSISTED' as const }
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
    await ctx.db.insert(
      'encounterSceneBindings',
      encounterSceneBindingSchema.parse({
        encounterId: base.run.id,
        campaignId: base.campaign.id,
        sceneId: base.sceneId,
        commandId: ids.command,
        commandFingerprint: checksumCanonicalJson({
          encounterId: base.run.id,
          sceneId: base.sceneId
        }),
        createdAt: new Date().toISOString()
      })
    )
  })
  return base
}

function input(base: Awaited<ReturnType<typeof fixture>>): NativeSpatialMovementInput {
  const token = base.tokens[0]!
  return {
    root: {
      commandId: ids.command,
      commandFingerprint: checksumCanonicalJson({ command: ids.command }),
      initiatorUserId: base.other.userId,
      correlationId: null,
      encounterId: base.run.id,
      sceneId: base.sceneId,
      tokenId: token.id.toLowerCase(),
      expectedEncounterVersion: base.run.version,
      expectedSceneVersion: 0,
      movementKind: 'VOLUNTARY',
      originalPath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
    },
    encounterId: base.run.id,
    expectedEncounterVersion: base.run.version,
    sceneId: base.sceneId,
    sceneVersion: 0,
    actorIdByTokenId: new Map([[token.id.toLowerCase(), base.run.actors[0]!.id]]),
    sceneTokens: base.tokens.map((value) => ({ ...value, id: value.id.toLowerCase() })),
    currentPosition: token.position,
    occurrenceId: ids.occurrence,
    executionCommandId: ids.command,
    occurredAt: new Date().toISOString(),
    autoRoll: true
  }
}

async function publicSpatialMovementResult(
  result: ReturnType<typeof evaluateNativeSpatialMovement>
) {
  const resolved = await result
  if (resolved.kind !== 'REACTION_BOUNDARY' || !('prefixSettlementPlan' in resolved))
    return resolved
  const { prefixSettlementPlan: _prefixSettlementPlan, ...publicResult } = resolved
  return publicResult
}

async function current(base: Awaited<ReturnType<typeof fixture>>) {
  return base.other.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run missing')
    const scope = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: base.run.id,
      sceneId: base.sceneId
    })
    const actor = await readRunActor(ctx, readRunState(row), base.run.actors[0]!.id)
    if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character fixture actor.')
    return {
      actor,
      effects: await scope!.list(),
      runVersion: row.version
    }
  })
}

describe('native spatial movement coordinator', () => {
  it('retains an applied-only terminal history without repeating mechanics or effect writes', async () => {
    const base = await fixture()
    await seedEffect(base)
    const movement = input(base)
    const completed = await base.other.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, movement)
    )
    if (completed.kind !== 'TERMINAL' || completed.result.status !== 'BATCH_COMPLETE')
      throw new Error('Fixture spatial result missing')
    const appliedPrefix = completed.result
    const before = await current(base)
    const after = await base.other.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, {
        ...movement,
        sceneVersion: appliedPrefix.sceneVersion,
        currentPosition: appliedPrefix.terminalPosition,
        sceneTokens: movement.sceneTokens.map((token) =>
          token.id === movement.root.tokenId
            ? { ...token, position: appliedPrefix.terminalPosition }
            : token
        ),
        frozenReactionRemainder: {
          root: {
            ...movement.root,
            originalPath: [...movement.root.originalPath],
            pathChecksum: checksumRuleDocument(movement.root.originalPath),
            pathStartDistance: 10,
            currentPosition: appliedPrefix.terminalPosition,
            currentSceneVersion: appliedPrefix.sceneVersion,
            resolutionCommands: []
          },
          completedSpatialExecutions: appliedPrefix.executions,
          appliedSpatialPrefix: appliedPrefix,
          completedReactionExecutions: [],
          currentSpatialCandidate: null,
          remainingSpatialCandidates: [],
          reactionTimeline: [],
          spatialSelectionChecksum: completed.selectionChecksum,
          spatialCurrentnessChecksum: checksumSpatialCurrentness({
            encounter: { id: base.run.id, version: base.run.version },
            candidates: []
          })
        }
      })
    )
    expect(after).toMatchObject({
      kind: 'TERMINAL',
      result: {
        status: 'BATCH_COMPLETE',
        executions: appliedPrefix.executions,
        encounterActorTransitions: appliedPrefix.encounterActorTransitions,
        spatialEffectTransitions: appliedPrefix.spatialEffectTransitions
      }
    })
    expect(await current(base)).toEqual(before)
  }, 30000)

  it('retains an applied prefix through later boundaries and settles its suffix exactly once', async () => {
    const base = await fixture()
    const firstEffect = await seedEffect(base)
    let suffixEffectId = crypto.randomUUID()
    while (suffixEffectId <= firstEffect.id) suffixEffectId = crypto.randomUUID()
    const movement = input(base)
    await base.other.caller.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.run.actors[0]!.id)
        )
        .unique()
      if (!actor) throw new Error('Fixture actor missing')
      const state = {
        ...encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson)),
        tempHitPoints: 5
      }
      await ctx.db.patch(actor._id, {
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state)
      })
      const scope = await createSpatialRuleEffectStore(ctx).scope({
        encounterId: base.run.id,
        sceneId: base.sceneId
      })
      await scope!.create({
        id: suffixEffectId,
        definition: firstEffect.definition,
        lifecycle: firstEffect.lifecycle,
        spatialState: firstEffect.spatialState,
        placement: {
          ...firstEffect.placement,
          geometry: {
            frame: 'SCENE_ABSOLUTE',
            shape: { kind: 'CIRCLE', center: { x: 8, y: 0 }, radius: 1 }
          }
        }
      })
    })
    const initial = await base.other.caller.run((ctx) =>
      publicSpatialMovementResult(
        evaluateNativeSpatialMovement(
          ctx,
          { ...movement, interruptAfterPathDistance: 4 },
          'PREVIEW'
        )
      )
    )
    if (initial.kind !== 'REACTION_BOUNDARY') throw new Error('Fixture boundary missing')
    expect(initial.completedExecutions).toHaveLength(1)
    expect(initial.remainingCandidates).toHaveLength(1)
    const appliedPrefix = await base.other.caller.run(async (ctx) => {
      const targets = await movementTargets.loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: [base.run.actors[0]!.id]
      })
      const plan = planNativeSpatialMovementPrefix({
        targets,
        executions: initial.completedExecutions,
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        campaignId: base.campaign.id,
        gameSystemId: base.run.gameSystemId,
        occurrenceId: movement.occurrenceId,
        sourceCommandId: movement.executionCommandId,
        occurredAt: movement.occurredAt,
        userId: base.other.userId
      })
      for (const { batch } of plan.settlements) await applyEncounterMechanicsBatch(ctx, batch)
      const scope = await createSpatialRuleEffectStore(ctx).scope({
        encounterId: base.run.id,
        sceneId: base.sceneId
      })
      await scope!.deleteCas({ id: firstEffect.id, expectedVersion: firstEffect.version })
      const execution = initial.completedExecutions[0]!
      const result = storedRuleExecutionResultDtoSchema.parse({
        status: 'BATCH_COMPLETE',
        batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
        schemaVersion: 1,
        occurrenceId: movement.occurrenceId,
        occurrenceVersion: 0,
        encounterId: base.run.id,
        encounterVersion: base.run.version + 1,
        sceneId: base.sceneId,
        sceneVersion: 1,
        tokenId: movement.root.tokenId,
        movementKind: movement.root.movementKind,
        terminalPosition: initial.boundaryPosition,
        executions: initial.completedExecutions,
        reactionExecutions: [],
        characterTransitions: [],
        encounterActorTransitions: [
          {
            targetActorId: base.run.actors[0]!.id,
            before: execution.targetTransition.before,
            after: execution.targetTransition.after
          }
        ],
        spatialEffectTransitions: [
          { effectId: firstEffect.id, transition: spatialEffectTransition(firstEffect) }
        ]
      })
      if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
        throw new Error('Fixture prefix missing')
      return result
    })
    const remainder: FrozenMovementReactionRemainder = {
      root: {
        ...movement.root,
        originalPath: [...movement.root.originalPath],
        pathChecksum: checksumRuleDocument(movement.root.originalPath),
        pathStartDistance: 4,
        currentPosition: initial.boundaryPosition,
        currentSceneVersion: 1,
        resolutionCommands: []
      },
      completedSpatialExecutions: [...initial.completedExecutions],
      appliedSpatialPrefix: appliedPrefix,
      completedReactionExecutions: [],
      currentSpatialCandidate: null,
      remainingSpatialCandidates: [...initial.remainingCandidates],
      reactionTimeline: [],
      spatialSelectionChecksum: initial.selectionChecksum,
      spatialCurrentnessChecksum: checksumSpatialCurrentness({
        encounter: { id: base.run.id, version: base.run.version },
        candidates: initial.remainingCandidates
      })
    }
    const atBoundary = {
      ...movement,
      sceneVersion: 1,
      currentPosition: initial.boundaryPosition,
      sceneTokens: movement.sceneTokens.map((token) =>
        token.id === movement.root.tokenId
          ? { ...token, position: initial.boundaryPosition }
          : token
      ),
      frozenReactionRemainder: remainder,
      interruptAfterPathDistance: 7
    }
    const afterPrefix = await current(base)
    expect(afterPrefix.actor.tempHitPoints).toBe(4)
    const next = await base.other.caller.run((ctx) =>
      publicSpatialMovementResult(evaluateNativeSpatialMovement(ctx, atBoundary, 'PREVIEW'))
    )
    if (next.kind !== 'REACTION_BOUNDARY') throw new Error('Later boundary missing')
    expect(next.appliedPrefix).toEqual(appliedPrefix)
    expect(next.completedExecutions.map((entry) => entry.ordinal)).toEqual([0, 1])
    expect(next.completedExecutions[1]!.targetTransition.after.temporaryHitPoints).toBe(3)
    expect(await current(base)).toEqual(afterPrefix)
    const resumed = {
      ...movement,
      sceneVersion: 2,
      currentPosition: next.boundaryPosition,
      sceneTokens: movement.sceneTokens.map((token) =>
        token.id === movement.root.tokenId ? { ...token, position: next.boundaryPosition } : token
      ),
      frozenReactionRemainder: {
        ...remainder,
        root: {
          ...remainder.root,
          currentSceneVersion: 2,
          currentPosition: next.boundaryPosition,
          pathStartDistance: next.boundaryDistance
        },
        completedSpatialExecutions: [...next.completedExecutions],
        remainingSpatialCandidates: [...next.remainingCandidates]
      }
    }
    const repeatedBoundary = await base.other.caller.run((ctx) =>
      publicSpatialMovementResult(
        evaluateNativeSpatialMovement(ctx, { ...resumed, interruptAfterPathDistance: 8 }, 'PREVIEW')
      )
    )
    expect(repeatedBoundary).toMatchObject({
      kind: 'REACTION_BOUNDARY',
      appliedPrefix,
      completedExecutions: next.completedExecutions
    })
    await expect(
      base.other.caller.run((ctx) =>
        evaluateNativeSpatialMovement(
          ctx,
          {
            ...resumed,
            frozenReactionRemainder: {
              ...resumed.frozenReactionRemainder,
              appliedSpatialPrefix: { ...appliedPrefix, tokenId: crypto.randomUUID() }
            }
          },
          'PREVIEW'
        )
      )
    ).rejects.toThrow('applied spatial prefix')
    await expect(
      base.other.caller.run(async (ctx) => {
        await evaluateNativeSpatialMovement(ctx, resumed)
        throw new Error('rollback suffix publication')
      })
    ).rejects.toThrow('rollback suffix publication')
    expect(await current(base)).toEqual(afterPrefix)
    const terminal = await base.other.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, resumed)
    )
    expect(terminal).toMatchObject({
      kind: 'TERMINAL',
      result: {
        executions: [{ ordinal: 0 }, { ordinal: 1 }],
        terminalPosition: { x: 10, y: 0 }
      }
    })
    const after = await current(base)
    expect(after.actor.tempHitPoints).toBe(3)
    expect(after.effects).toHaveLength(0)
  }, 30000)

  it('completes a real no-candidate movement through the owner transaction', async () => {
    const base = await fixture()
    const result = await base.other.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, input(base))
    )
    expect(result).toMatchObject({
      kind: 'NO_CANDIDATES',
      movementIntent: { position: { x: 10, y: 0 } }
    })
  }, 30000)

  it.each([false, true])(
    'executes and consumes a damage root with near-origin return %s',
    async (returnNearOrigin) => {
      const base = await fixture()
      await seedEffect(base)
      const movement = input(base)
      if (returnNearOrigin)
        movement.root.originalPath = [...movement.root.originalPath, { x: 5e-9, y: 0 }]
      const beforePreview = await current(base)
      const preview = await base.other.caller.run((ctx) =>
        evaluateNativeSpatialMovement(ctx, movement, 'PREVIEW')
      )
      expect(await current(base)).toEqual(beforePreview)
      const result = await base.other.caller.run((ctx) =>
        evaluateNativeSpatialMovement(ctx, movement)
      )
      expect(result).toEqual(preview)
      expect(result).toMatchObject({
        kind: 'TERMINAL',
        result: {
          status: 'BATCH_COMPLETE',
          sceneVersion: returnNearOrigin ? 0 : 1,
          encounterActorTransitions: [{ after: { currentHitPoints: 0 } }],
          spatialEffectTransitions: [{ transition: { kind: 'DELETE' } }]
        }
      })
      if (returnNearOrigin) expect(result).toMatchObject({ movementIntent: null })
      const stored = await current(base)
      expect(stored.actor.currentHitPoints).toBe(0)
      expect(stored.effects).toEqual([])
      expect(stored.runVersion).toBe(base.run.version)
    }
  )

  it('reuses caller-loaded movement targets without changing preview results', async () => {
    const base = await fixture()
    await seedEffect(base)
    const movement = input(base)
    const previewWithHydration = await base.other.caller.run(async (ctx) => {
      const targets = await movementTargets.loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: [base.run.actors[0]!.id]
      })
      const loader = vi.spyOn(movementTargets, 'loadMovementTargets')
      const defaultPreview = await evaluateNativeSpatialMovement(ctx, movement, 'PREVIEW')
      const projectedPreview = await evaluateNativeSpatialMovement(
        ctx,
        movement,
        'PREVIEW',
        targets
      )
      expect(loader).toHaveBeenCalledTimes(1)
      expect(projectedPreview).toEqual(defaultPreview)
      return defaultPreview
    })
    expect(previewWithHydration).toMatchObject({
      kind: 'TERMINAL',
      result: { encounterActorTransitions: [{ after: { currentHitPoints: 0 } }] }
    })
    expect((await current(base)).actor.currentHitPoints).toBe(1)
  })

  it('uses projected movement target hit points for terminal transitions without persistence', async () => {
    const base = await fixture()
    await seedEffect(base)
    const before = await current(base)
    const result = await base.other.caller.run(async (ctx) => {
      const targets = await movementTargets.loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: [base.run.actors[0]!.id]
      })
      const target = targets.get(base.run.actors[0]!.id)!
      const projectedActor = { ...target.actor, tempHitPoints: target.state.temporary + 1 }
      const projected = buildMovementTarget({
        actor: projectedActor,
        activeEffects: target.activeEffects,
        gameSystemId: base.campaign.gameSystemId,
        campaignId: base.campaign.id,
        characterFacts: target.characterFacts
      })
      return evaluateNativeSpatialMovement(
        ctx,
        input(base),
        'PREVIEW',
        new Map([[projected.actor.id, projected]])
      )
    })
    expect(result).toMatchObject({
      kind: 'TERMINAL',
      result: {
        encounterActorTransitions: [
          {
            before: { currentHitPoints: 1, temporaryHitPoints: 1 },
            after: { currentHitPoints: 1, temporaryHitPoints: 0 }
          }
        ]
      }
    })
    expect(await current(base)).toEqual(before)
  })

  it.each([
    ['missing', () => new Map<string, MovementTarget>()],
    [
      'actor id',
      (target: MovementTarget) =>
        new Map([
          [target.actor.id, { ...target, actor: { ...target.actor, id: crypto.randomUUID() } }]
        ])
    ],
    [
      'encounter',
      (target: MovementTarget) =>
        new Map([
          [
            target.actor.id,
            { ...target, actor: { ...target.actor, encounterId: crypto.randomUUID() } }
          ]
        ])
    ],
    [
      'system',
      (target: MovementTarget) =>
        new Map([
          [
            target.actor.id,
            { ...target, actor: { ...target.actor, systemId: crypto.randomUUID() } }
          ]
        ])
    ]
  ])('rejects a %s projected movement target map entry', async (_label, makeMap) => {
    const base = await fixture()
    await seedEffect(base)
    await expect(
      base.other.caller.run(async (ctx) => {
        const target = (
          await movementTargets.loadMovementTargets(ctx, {
            encounterId: base.run.id,
            expectedEncounterVersion: base.run.version,
            targetActorIds: [base.run.actors[0]!.id]
          })
        ).get(base.run.actors[0]!.id)!
        const targets = makeMap(target)
        return evaluateNativeSpatialMovement(ctx, input(base), 'PREVIEW', targets)
      })
    ).rejects.toThrow('Projected spatial target does not match the Run.')
  })

  it('rolls target and effect writes back when the parent mutation fails later', async () => {
    const base = await fixture()
    await seedEffect(base)
    const before = await current(base)
    await expect(
      base.other.caller.run(async (ctx) => {
        const evaluated = await evaluateNativeSpatialMovement(ctx, input(base))
        expect(evaluated.kind).toBe('TERMINAL')
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        const actor = await readRunActor(ctx, readRunState(row!), base.run.actors[0]!.id)
        if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character fixture actor.')
        expect(actor.currentHitPoints).toBe(0)
        throw new Error('Parent Scene abort')
      })
    ).rejects.toThrow('Parent Scene abort')
    expect(await current(base)).toEqual(before)
  })

  it('reveals a repeatable effect and retains its incremented root', async () => {
    const base = await fixture()
    const effect = await seedEffect(base, true)
    const before = await current(base)
    const movement = input(base)
    const preview = await base.other.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, movement, 'PREVIEW')
    )
    expect(await current(base)).toEqual(before)
    const committed = await base.other.caller.run((ctx) =>
      evaluateNativeSpatialMovement(ctx, movement)
    )
    expect(committed).toEqual(preview)
    const stored = await current(base)
    expect(stored.effects).toHaveLength(1)
    expect(stored.effects[0]).toMatchObject({
      id: effect.id,
      version: effect.version + 1,
      spatialState: { revealed: true }
    })
  })

  it('leaves targets and effects unchanged in Manual mode', async () => {
    const base = await fixture()
    await seedEffect(base)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!row) throw new Error('Fixture Run missing')
      const state = { ...readRunState(row), automationMode: 'MANUAL' as const }
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state)
      })
    })
    const before = await current(base)
    expect(
      await base.other.caller.run((ctx) => evaluateNativeSpatialMovement(ctx, input(base)))
    ).toMatchObject({ kind: 'MANUAL' })
    expect(await current(base)).toEqual(before)
  })

  it('rejects stale Run and Scene binding state', async () => {
    const base = await fixture()
    await expect(
      base.other.caller.run((ctx) =>
        evaluateNativeSpatialMovement(ctx, { ...input(base), expectedEncounterVersion: -1 })
      )
    ).rejects.toThrow('Encounter version is stale.')
    await expect(
      base.other.caller.run((ctx) =>
        evaluateNativeSpatialMovement(ctx, { ...input(base), sceneId: crypto.randomUUID() })
      )
    ).rejects.toThrow('Encounter Scene binding is stale.')
  }, 30000)
})
