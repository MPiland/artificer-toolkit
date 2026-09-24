import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { FrozenMovementReactionRemainder } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementRuleService'
import { prepareEncounterMovementContinuation } from '@artificer-toolkit/rules-runtime/encounterMovementContinuation'
import { revalidateEncounterMovementReactionOption } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDiscovery'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { MutationCtx } from '../_generated/server'
import {
  evaluateNativeSpatialMovement,
  type NativeSpatialPrefixSettlement
} from '../encounters/spatialMovement'
import type { MovementTarget } from '../encounters/movementTargets'
import type { NativeMaintenanceProjection } from '../encounters/actionMaintenance'
import { prepareNativeMovementConcentration } from '../encounters/movementConcentration'
import { createRulesRuntime } from '../rules/runtime'
import { evaluateAutomaticMovementActions } from './movementInitialActions.helper'
import { readSceneMovementReactionPerception } from './movementPerceptionValidation'
import {
  discoverSceneMovementPassage,
  prepareSceneMovementPassageBoundary
} from './movementPassageBoundary'
import type { SceneMovementSettlement } from './movementSettlements'

type NativeInput = Parameters<typeof evaluateNativeSpatialMovement>[1]
type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
/** Native reads and writes stay inside the caller's mutation. */
export async function evaluateSceneMovementContinuation(
  ctx: MutationCtx,
  input: {
    maintenanceProjection?: NativeMaintenanceProjection
    request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
    state: EncounterRunState
    userId: string
    root: NativeInput['root']
    sceneVersion: number
    sceneTokens: readonly SceneToken[]
    actorIdByTokenId: ReadonlyMap<string, string>
    currentPosition: SceneToken['position']
    occurrenceId: string
    occurrenceVersion: number
    executionCommandId: string
    occurredAt: string
    reactionTimeline: FrozenMovementReactionRemainder['reactionTimeline']
    targets: ReadonlyMap<string, MovementTarget>
    remainder?: FrozenMovementReactionRemainder
    evidence?: Pick<NativeInput, 'pendingSnapshot' | 'resolution' | 'resolutionCommand'>
    retained?: Outcome
  }
) {
  return prepareEncounterMovementContinuation<
    NonNullable<MovementTarget['characterFacts']>,
    NativeMaintenanceProjection,
    NativeSpatialPrefixSettlement,
    SceneMovementSettlement
  >(input, {
    discoverPassage: () => discoverSceneMovementPassage(ctx, input),
    evaluateSpatial: (step, targets, stageTerminalSettlement) =>
      evaluateNativeSpatialMovement(ctx, step, 'PREVIEW', targets, stageTerminalSettlement),
    prepareConcentration: async ({
      remainder,
      targets,
      projection,
      executionOrdinal,
      retainedChecks
    }) => {
      const prepared = await prepareNativeMovementConcentration(ctx, {
        state: input.state,
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.executionCommandId,
        userId: input.userId,
        occurredAt: input.occurredAt,
        remainder,
        targets,
        projection,
        source: { kind: 'SPATIAL', executionOrdinal },
        ...(retainedChecks ? { retainedChecks } : {})
      })
      return {
        ...prepared,
        settlements: prepared.settlements.map((plan) => ({
          kind: 'CONCENTRATION' as const,
          plan
        }))
      }
    },
    preparePassage: ({ root, boundary, passage, reactionTimeline, targets }) =>
      prepareSceneMovementPassageBoundary(ctx, {
        ...input,
        root,
        boundary,
        passage,
        reactionTimeline,
        origin: input.currentPosition,
        targets
      }),
    evaluateAutomatic: ({ root, boundary, reactionTimeline, targets, projection }) =>
      evaluateAutomaticMovementActions({
        ctx,
        ...input,
        root,
        boundary,
        reactionTimeline,
        encounterId: input.state.id,
        expectedEncounterVersion: input.state.version,
        sceneId: root.sceneId,
        projectedTargets: targets,
        maintenanceProjection: projection,
        ...(input.retained ? { retained: input.retained } : {})
      }),
    validateReactionOptions: async ({ next, root, position, targets }) => {
      const projected = await readSceneMovementReactionPerception(
        ctx,
        input.request,
        input.request.perceptionEnvironments ?? [],
        targets
      )
      if (!projected) throw new Error('Projected movement reaction facts are unavailable.')
      for (const option of next.group.options)
        await revalidateEncounterMovementReactionOption({
          ...projected.facts,
          movementKind: root.movementKind,
          occurrenceId: input.occurrenceId,
          option,
          actorIdByTokenId: input.actorIdByTokenId,
          tokens: input.sceneTokens.map((token) =>
            token.id === root.tokenId ? { ...token, position } : token
          ),
          resolvePerception: projected.resolvePerception
        })
    },
    runtime: () => createRulesRuntime(ctx, input.userId),
    spatialSettlement: (plan) => ({ kind: 'SPATIAL', plan })
  })
}
