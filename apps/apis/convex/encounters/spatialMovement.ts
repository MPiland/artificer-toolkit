import { spatialEffectTransition } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementRuleService'
import {
  prepareEncounterSpatialMovement,
  type PreparedSpatialMovementPlan,
  type SpatialMovementPreparationInput
} from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPreparation'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import { z } from 'zod'
import type { MutationCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { nextRollInt } from '../lib/rollRandom'
import { requireCampaignAuthority } from '../campaigns/authority'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import { createRulesRuntime } from '../rules/runtime'
import { readRunState } from './documents'
import { loadMovementTargets, type MovementTarget } from './movementTargets'
import { applyEncounterMechanicsBatch } from './mechanicsBatch'
import { loadNativeConcentrationState } from './concentrationState'
import type { NativeMaintenanceProjection } from './actionMaintenance'
import { spatialMovementEffectBeforeTransition } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementEffects'
import { projectSpatialMovementResult } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementResult'
import { rejectDomain } from '../lib/domainRejections'

type SpatialScope = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createSpatialRuleEffectStore>['scope']>>
>

export type NativeSpatialMovementInput = SpatialMovementPreparationInput & {
  encounterId: string
  expectedEncounterVersion: number
  interruptForConcentration?: boolean
  maintenanceProjection?: NativeMaintenanceProjection
}

export type NativeSpatialPrefixSettlement = PreparedSpatialMovementPlan<
  NonNullable<MovementTarget['characterFacts']>
> & {
  ctx: MutationCtx
  scope: SpatialScope
  publication: 'PREVIEW' | 'COMMIT'
}

async function applySpatialExecutions(input: NativeSpatialPrefixSettlement) {
  const historical =
    input.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
    input.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? input.appliedSpatialPrefix
      : null
  const settlements: Parameters<typeof projectSpatialMovementResult>[0]['settlements'][number][] =
    []
  const planned = input.mechanicsPlan
  for (const { batch, plan } of planned.settlements) {
    const target = input.targets.get(batch.targetActorId)!
    const applied =
      input.publication === 'PREVIEW'
        ? plan
        : await applyEncounterMechanicsBatch(input.ctx, batch, target.characterFacts?.sourceContext)
    if (
      target.actor.kind === 'CHARACTER' &&
      applied.characterStreamVersion !== plan.characterStreamVersion
    )
      throw new Error('Spatial Character publication does not match its planned version.')
    settlements.push({
      targetActorId: batch.targetActorId,
      targetTransition: applied.targetTransition,
      characterStreamVersion: applied.characterStreamVersion
    })
  }
  for (const effectId of [
    ...new Set(input.executions.map((execution) => execution.candidate.candidate.effectId))
  ].sort()) {
    const effect = input.effects.get(effectId)!
    const transition = spatialEffectTransition(effect)
    const prior = historical?.spatialEffectTransitions.find((entry) => entry.effectId === effectId)
    if (input.publication === 'COMMIT' && prior)
      spatialMovementEffectBeforeTransition({
        current: await input.scope.get(effectId),
        consumed: effect,
        effectId,
        transition,
        encounterId: input.state.id,
        sceneId: input.input.sceneId,
        allowUnapplied: false
      })
    if (input.publication === 'COMMIT' && !prior && transition.kind === 'DELETE')
      await input.scope.deleteCas({ id: effect.id, expectedVersion: effect.version })
    if (input.publication === 'COMMIT' && !prior && transition.kind === 'UPDATE')
      await input.scope.updateCurrentStateCas({
        id: effect.id,
        expectedVersion: effect.version,
        lifecycle: effect.lifecycle,
        spatialState: { schemaVersion: 1, revealed: true }
      })
  }
  return projectSpatialMovementResult({
    occurrenceId: input.input.occurrenceId,
    occurrenceVersion: input.input.occurrenceVersion ?? 0,
    encounterId: input.state.id,
    encounterVersion: input.state.version + 1,
    sceneId: input.input.sceneId,
    sceneVersion: input.input.sceneVersion,
    root: input.root,
    currentPosition: input.input.currentPosition,
    terminalPosition: input.terminalPosition,
    executions: input.executions,
    effects: input.effects,
    targets: input.targets,
    settlements,
    appliedSpatialPrefix: historical,
    completedReactionExecutions: input.completedReactionExecutions,
    remainingEffectIds: input.remainingEffectIds
  })
}

/** Applies a prefix only after its PREVIEW receipt matched retained Scene evidence. */
export async function settleNativeSpatialMovementPrefix(input: NativeSpatialPrefixSettlement) {
  const result = await applySpatialExecutions({ ...input, publication: 'COMMIT' })
  const characterTransitions = input.mechanicsPlan.settlements.flatMap(({ batch, plan }) => {
    const target = input.targets.get(batch.targetActorId)!
    if (target.actor.kind !== 'CHARACTER') return []
    if (batch.expectedCharacterStreamVersion === null || plan.characterStreamVersion === null)
      throw new Error('Spatial Character settlement span is unavailable.')
    return [
      {
        characterId: target.actor.sourceId,
        targetActorId: batch.targetActorId,
        beforeStreamVersion: batch.expectedCharacterStreamVersion,
        afterStreamVersion: plan.characterStreamVersion,
        before: plan.targetTransition.before,
        after: plan.targetTransition.after
      }
    ]
  })
  return { result, characterTransitions }
}

/** The calling mutation owns Session/Scene authority, occurrence replay, and Run/token/fog publication. */
export async function evaluateNativeSpatialMovement(
  ctx: MutationCtx,
  input: NativeSpatialMovementInput,
  publication: 'PREVIEW' | 'COMMIT' = 'COMMIT',
  /** Current or projected facts from this same mutation, never retained across requests. */
  movementTargets?: ReadonlyMap<string, MovementTarget>,
  /** Scene PREVIEW can retain the terminal plan for its ordered finish transaction. */
  stageTerminalSettlement?: (plan: NativeSpatialPrefixSettlement) => void
) {
  if (stageTerminalSettlement && publication !== 'PREVIEW')
    throw new Error('Only spatial preparation may stage a terminal settlement plan.')
  if (input.retainedExecutions && publication !== 'PREVIEW')
    throw new Error('Retained spatial replay evidence is allowed only during preparation preview.')
  const {
    retainedExecutions,
    interruptForConcentration,
    maintenanceProjection,
    encounterId: submittedEncounterId,
    expectedEncounterVersion,
    occurredAt: submittedOccurredAt,
    ...evaluationInput
  } = input
  const encounterId = serverUuidIdentityDtoSchema.parse(submittedEncounterId)
  const occurredAt = z.iso.datetime().parse(submittedOccurredAt)
  const { userId } = await requireIdentity(ctx)
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!row) throw new Error('Encounter Run was not found.')
  const state = readRunState(row)
  const { campaign } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  if (state.version !== expectedEncounterVersion) rejectDomain('VERSION_STALE')
  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId,
    sceneId: input.sceneId
  })
  if (!scope) throw new Error('Encounter Scene binding is stale.')
  const evaluated = await prepareEncounterSpatialMovement({
    input: { ...evaluationInput, occurredAt, retainedExecutions },
    state,
    userId,
    runtime: state.automationMode === 'MANUAL' ? undefined : await createRulesRuntime(ctx, userId),
    rollD20: () => nextRollInt(20) + 1,
    spatialScope: {
      list: () => scope.list(),
      get: (id) => scope.get(id)
    },
    loadTargets: async (actorIds) => {
      if (!movementTargets)
        return loadMovementTargets(ctx, {
          encounterId,
          expectedEncounterVersion: state.version,
          targetActorIds: actorIds
        })
      return new Map(
        actorIds.map((id) => {
          const target = movementTargets.get(id)
          if (
            !target ||
            target.actor.id !== id ||
            target.actor.encounterId !== encounterId ||
            target.actor.systemId !== state.gameSystemId ||
            !state.actorIds.includes(id)
          )
            throw new Error('Projected spatial target does not match the Run.')
          return [id, target] as const
        })
      )
    },
    determineConcentrationActorIds:
      interruptForConcentration && state.automationMode !== 'MANUAL'
        ? async (actorIds, targets) => {
            const actorIdsWithConcentration = new Set<string>()
            for (const targetActorId of actorIds)
              if (
                await loadNativeConcentrationState(ctx, {
                  state,
                  readVersion: state.version,
                  targetActorId,
                  userId,
                  targets,
                  projection: maintenanceProjection
                })
              )
                actorIdsWithConcentration.add(targetActorId)
            return actorIdsWithConcentration
          }
        : undefined,
    settleTerminal: async (plan) => {
      const terminalPlan: NativeSpatialPrefixSettlement = {
        ...plan,
        ctx,
        scope,
        publication
      }
      if (plan.executions.length) stageTerminalSettlement?.(terminalPlan)
      return applySpatialExecutions(terminalPlan)
    }
  })
  if (evaluated.kind !== 'REACTION_BOUNDARY' || !('prefixSettlementPlan' in evaluated))
    return evaluated
  const prefixSettlementPlan: NativeSpatialPrefixSettlement = {
    ...evaluated.prefixSettlementPlan,
    ctx,
    scope,
    publication: 'PREVIEW'
  }
  return { ...evaluated, prefixSettlementPlan }
}
