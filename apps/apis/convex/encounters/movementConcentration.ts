import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { MovementConcentrationExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import type { FrozenMovementReactionRemainder } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementRuleService'
import {
  prepareEncounterMovementConcentration,
  type MovementConcentrationSettlement
} from '@artificer-toolkit/rules-runtime/encounterMovementConcentration'
export {
  movementDamageEnvelope,
  movementConcentrationDamageSource
} from '@artificer-toolkit/rules-runtime/encounterMovementConcentration'
import type { MutationCtx } from '../_generated/server'
import { createRulesRuntime } from '../rules/runtime'
import { nextRollInt } from '../lib/rollRandom'
import type { NativeMaintenanceProjection } from './actionMaintenance'
import { createNativeConcentrationContext } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { loadNativeConcentrationState, prepareNativeConcentrationEnd } from './concentrationState'
import { executeNativeConcentrationCheck } from './concentration'
import { persistNativeConcentrationResult } from './actionChildPersistence'
import { readRunActors } from './documents'
import { projectNativeMovementConcentrationEnd } from './movementMaintenance'
import type { MovementTarget } from './movementTargets'

type DamageSource = { kind: 'SPATIAL' | 'REACTION'; executionOrdinal: number }
type DiceResolution = Extract<
  ResolveRuleOccurrenceInputDto['resolution'],
  { kind: 'ENTER_DICE' | 'SYSTEM_ROLL' }
>

export type NativeMovementConcentrationSettlement = MovementConcentrationSettlement

/** Forecast checks between contacts; only the Scene finish mutation applies these plans. */
export async function prepareNativeMovementConcentration(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    occurrenceId: string
    sourceCommandId: string
    userId: string
    occurredAt: string
    remainder: FrozenMovementReactionRemainder
    source: DamageSource
    targets: ReadonlyMap<string, MovementTarget>
    projection?: NativeMaintenanceProjection
    retainedChecks?: readonly MovementConcentrationExecutionDto[]
    resume?: { snapshot: ServerKernelRuleExecutionPendingSnapshotDto; resolution: DiceResolution }
  }
) {
  return prepareEncounterMovementConcentration(input, {
    loadState: (targetActorId, targets, projection) =>
      loadNativeConcentrationState(ctx, {
        state: input.state,
        readVersion: input.state.version,
        targetActorId,
        userId: input.userId,
        targets,
        projection
      }),
    runtime: () => createRulesRuntime(ctx, input.userId),
    random: nextRollInt,
    projectEnd: async (context, targets, projection) =>
      projectNativeMovementConcentrationEnd({
        maintenance: await prepareNativeConcentrationEnd(ctx, {
          state: input.state,
          context,
          targets,
          projection
        }),
        targets,
        projection,
        campaignId: input.state.campaignId,
        gameSystemId: input.state.gameSystemId,
        occurredAt: input.occurredAt
      })
  })
}

/** Replays recorded dice and verifies the forecast inside the enclosing Scene transaction. */
export async function settleNativeMovementConcentration(
  ctx: MutationCtx,
  input: NativeMovementConcentrationSettlement,
  encounterVersion: number
) {
  const current = await loadNativeConcentrationState(ctx, {
    state: input.state,
    readVersion: input.state.version,
    targetActorId: input.context.application.targetActorId,
    userId: input.userId
  })
  if (
    !current ||
    checksumRuleDocument(
      createNativeConcentrationContext({ current, ...input.context }).context
    ) !== checksumRuleDocument(input.context)
  )
    throw new Error('Movement Concentration settlement facts are stale.')
  const completed = await executeNativeConcentrationCheck(ctx, {
    ...input,
    current,
    actors: await readRunActors(ctx, input.state),
    occurrenceVersion: 1,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: input.continuation.request.requestId,
      rawFaces: input.execution.result.applicationOutputs.d20.rawFaces
    }
  })
  if (checksumRuleDocument(completed.result) !== checksumRuleDocument(input.execution.result))
    throw new Error('Movement Concentration settlement does not match its forecast.')
  await persistNativeConcentrationResult(ctx, {
    state: { ...input.state, version: encounterVersion },
    result: completed.result,
    commandId: concentrationCommandId(completed.result.occurrenceId),
    fingerprint: checksumRuleDocument(input.execution),
    userId: input.userId,
    correlationId: input.context.parentOccurrenceId,
    occurredAt: input.occurredAt,
    metadata: {
      schemaVersion: 1,
      transition: 'START',
      definitionId: current.published.id,
      expectedAggregateVersion: encounterVersion,
      factsChecksum: input.execution.result.initialFactsChecksum,
      optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
    }
  })
  return input.execution
}
