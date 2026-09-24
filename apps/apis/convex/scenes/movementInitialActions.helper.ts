import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { evaluateEncounterAutomaticMovementActions } from '@artificer-toolkit/rules-runtime/encounterAutomaticMovementActions'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readRunState } from '../encounters/documents'
import type { MovementTarget } from '../encounters/movementTargets'
import type { NativeMaintenanceProjection } from '../encounters/actionMaintenance'
import { prepareNativeMovementConcentration } from '../encounters/movementConcentration'
import {
  executeNativeMovementReactionAction,
  planNativeMovementReactionAction,
  prepareNativeMovementReactionAction
} from '../encounters/actionMovementReactions'
import { retainNativeMovementLegendaryResistance } from '../encounters/movementLegendaryResistance'
import { replayNativeMovementReactionAction } from '../encounters/movementReactionReplay'
import { evaluateNativeSpatialMovement } from '../encounters/spatialMovement'
import { createRulesRuntime } from '../rules/runtime'
import { readSceneMovementReactionPerception } from './movementPerceptionValidation'
import type { SceneMovementSettlement } from './movementSettlements'
import { discoverSceneMovementPassage } from './movementPassageBoundary'
import { evaluateSceneMovementContinuation } from './movementContinuation.helper'

type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
type Boundary = Extract<
  Awaited<ReturnType<typeof evaluateNativeSpatialMovement>>,
  { kind: 'REACTION_BOUNDARY' }
>

/** Stages initial System-selected actions; callers settle the retained plans only during publication. */
export async function evaluateAutomaticMovementActions(input: {
  ctx: MutationCtx
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
  root: Parameters<typeof evaluateNativeSpatialMovement>[1]['root']
  boundary: Boundary
  reactionTimeline: NonNullable<
    Parameters<typeof evaluateNativeSpatialMovement>[1]['initialReactionTimeline']
  >
  occurrenceId: string
  occurrenceVersion: number
  executionCommandId: string
  occurredAt: string
  encounterId: string
  expectedEncounterVersion: number
  sceneId: string
  sceneVersion: number
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
  projectedTargets?: ReadonlyMap<string, MovementTarget>
  maintenanceProjection?: NativeMaintenanceProjection
  retained?: Extract<Outcome, { kind: 'TERMINAL' | 'PENDING' }>
}): Promise<{ outcome: Outcome; settlements: SceneMovementSettlement[] } | null> {
  const first = input.reactionTimeline[0]
  if (!first || first.kind !== 'AUTOMATIC_ACTION') return null
  const run = await input.ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run || readRunState(run).automationMode !== 'AUTOMATIC')
    throw new Error('Automatic movement reactions require Automatic Run mode.')
  const state = readRunState(run)
  const perception = await readSceneMovementReactionPerception(
    input.ctx,
    input.request,
    input.request.perceptionEnvironments ?? [],
    input.projectedTargets
  )
  if (!perception) throw new Error('Automatic movement reaction facts are unavailable.')
  const { userId } = await requireIdentity(input.ctx)
  const runtime = await createRulesRuntime(input.ctx, userId)
  const passage = input.root.terminalPassageStop
    ? null
    : await discoverSceneMovementPassage(input.ctx, {
        state,
        root: input.root,
        sceneTokens: input.sceneTokens,
        actorIdByTokenId: input.actorIdByTokenId
      })
  return evaluateEncounterAutomaticMovementActions(
    {
      ...input,
      state,
      userId,
      runtime,
      facts: perception.facts,
      resolvePerception: perception.resolvePerception,
      passage
    },
    {
      prepareReaction: ({ targets, maintenanceProjection, ...revalidate }) =>
        prepareNativeMovementReactionAction(input.ctx, revalidate, targets, maintenanceProjection),
      executeReaction: (args) => executeNativeMovementReactionAction(input.ctx, args),
      replayReaction: (args) => replayNativeMovementReactionAction({ ...args, ctx: input.ctx }),
      planReaction: planNativeMovementReactionAction,
      retainLegendary: retainNativeMovementLegendaryResistance,
      prepareConcentration: (args) => prepareNativeMovementConcentration(input.ctx, args),
      continueMovement: (args) =>
        evaluateSceneMovementContinuation(input.ctx, { ...args, request: input.request })
    }
  )
}
