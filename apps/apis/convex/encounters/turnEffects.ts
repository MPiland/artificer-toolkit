import {
  prepareEncounterTurnEffects,
  evaluateEncounterTurnEffects,
  turnEffectMechanicsBatch
} from '@artificer-toolkit/rules-runtime/encounterTurnEffects'
import {
  isTurnEffectEligible,
  turnEffectOwner,
  turnEffectSelectionChecksum,
  requireTurnMaintainedStates,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  storedRuleExecutionResultDtoSchema,
  type StagedTurnEffectPlanDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { nextRollInt } from '../lib/rollRandom'
import { createRulesRuntime } from '../rules/runtime'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import { applyEncounterMechanicsBatch } from './mechanicsBatch'
import { loadMovementTargets, type MovementTarget } from './movementTargets'
import { readRunActors } from './documents'
import { resolveNativeTurnEffectPerception } from './turnEffectPerception'

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/** Supplies authorized native reads to the shared turn-effect planner. */
export async function prepareNativeTurnEffects(
  input: Omit<
    Parameters<
      typeof prepareEncounterTurnEffects<NonNullable<MovementTarget['characterFacts']>>
    >[0],
    | 'listEffects'
    | 'loadMaintainedState'
    | 'loadTarget'
    | 'createRuntime'
    | 'rollD20'
    | 'resolvePerception'
  > & { ctx: MutationCtx }
) {
  const store = createActiveRuleEffectStore(input.ctx)
  return prepareEncounterTurnEffects({
    ...input,
    listEffects: (owner) => store.list(owner),
    loadMaintainedState: (stateId) =>
      store.findMaintainedStateById({ encounterId: input.state.id, stateId }),
    loadTarget: async (actorId) =>
      (
        await loadMovementTargets(input.ctx, {
          encounterId: input.state.id,
          expectedEncounterVersion: input.state.version,
          targetActorIds: [actorId]
        })
      ).get(actorId),
    createRuntime: () => createRulesRuntime(input.ctx, input.userId),
    rollD20: () => nextRollInt(20) + 1,
    resolvePerception: (perception) =>
      resolveNativeTurnEffectPerception(input.ctx, {
        ...perception,
        state: input.state,
        userId: input.userId
      })
  })
}

/** The owning terminal mutation publishes this phase and its surrounding Run transition atomically. */
export async function persistNativeTurnEffects(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    userId: string
    occurrenceId: string
    occurrenceVersion: number
    rootCommandId: string
    occurredAt: string
    plan: StagedTurnEffectPlanDto | null
  }
): Promise<{ result: StoredRuleExecutionResultDto | null; actors: EncounterRunActorState[] }> {
  if (!input.plan) return { result: null, actors: [] }
  const first = input.plan.executions[0]
  if (!first || input.plan.executions.length > 128)
    throw new Error('Turn effect plan is unavailable.')
  if (first.boundaryOrdinal !== 0 && first.boundaryOrdinal !== 1)
    throw new Error('Turn effect boundary is invalid.')
  const boundary: TurnEffectBoundary = {
    ordinal: first.boundaryOrdinal,
    stage: first.stage,
    actorId: first.targetActorId
  }
  if (
    input.plan.executions.some(
      (entry) =>
        entry.targetActorId !== boundary.actorId ||
        entry.boundaryOrdinal !== boundary.ordinal ||
        entry.stage !== boundary.stage
    )
  )
    throw new Error('Turn effect phase contains unrelated executions.')
  const targets = await loadMovementTargets(ctx, {
    encounterId: input.state.id,
    expectedEncounterVersion: input.state.version,
    targetActorIds: [first.targetActorId]
  })
  const target = targets.get(first.targetActorId)
  if (!target) throw new Error('Turn effect target is unavailable.')
  const effects = target.activeEffects
  const candidates = effects
    .filter((effect) => isTurnEffectEligible(effect, target.actor, input.state, boundary.stage))
    .sort(
      (left, right) => left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
    )
  const maintainedStates = await requireTurnMaintainedStates(
    input.state.id,
    candidates,
    (stateId) =>
      createActiveRuleEffectStore(ctx).findMaintainedStateById({
        encounterId: input.state.id,
        stateId
      })
  )
  const commandType = input.state.status === 'PREPARED' ? 'START' : 'ADVANCE_TURN'
  const evaluated = await evaluateEncounterTurnEffects({
    ...input,
    // The retained plan replays its recorded evidence and never rolls.
    autoRoll: false,
    createRuntime: () => createRulesRuntime(ctx, input.userId),
    rollD20: () => nextRollInt(20) + 1,
    resolvePerception: (perception) =>
      resolveNativeTurnEffectPerception(ctx, {
        ...perception,
        state: input.state,
        userId: input.userId
      }),
    boundary,
    target,
    targets,
    effects,
    candidates,
    actors: await readRunActors(ctx, input.state),
    selectionChecksum: turnEffectSelectionChecksum(
      commandType,
      boundary,
      target.actor,
      input.state.id,
      candidates
    ),
    retainedPlan: input.plan
  })
  if (evaluated.kind !== 'COMPLETE') throw new Error('Turn effect plan is incomplete.')
  const batch = turnEffectMechanicsBatch({
    ...input,
    boundary,
    target,
    applications: evaluated.applications,
    retainedConditionIds: evaluated.retainedConditionIds
  })
  const planned = planEncounterMechanicsBatch({
    batch,
    actor: target.actor,
    userId: input.userId,
    characterFacts: target.characterFacts ?? undefined
  })
  const last = input.plan.executions.at(-1)!
  if (
    !same(planned.targetTransition.before, first.targetTransition.before) ||
    !same(planned.targetTransition.after, last.targetTransition.after)
  )
    throw new Error('Grouped turn effect target transition is stale.')
  const store = createActiveRuleEffectStore(ctx)
  const terminalMaintainedStateIds = new Set<string>()
  for (const execution of evaluated.plan.executions) {
    if (execution.lifecycle.kind === 'EXPIRE') {
      const stateId = candidates.find(
        (effect) => effect.id === execution.activeEffectId
      )?.maintainedEffectStateId
      if (stateId !== null && stateId !== undefined) terminalMaintainedStateIds.add(stateId)
      await store.deleteCas({
        id: execution.activeEffectId,
        owner: turnEffectOwner(target.actor, input.state.id),
        expectedVersion: execution.lifecycle.expectedVersion
      })
    } else
      await store.updateLifecycleCas({
        id: execution.activeEffectId,
        owner: turnEffectOwner(target.actor, input.state.id),
        expectedVersion: execution.lifecycle.expectedVersion,
        lifecycle: { schemaVersion: 1, remainingTicks: execution.lifecycle.afterRemainingTicks }
      })
  }
  const terminatedMaintainedStates = []
  for (const stateId of [...terminalMaintainedStateIds].sort()) {
    const state = maintainedStates.get(stateId)
    if (!state) throw new Error('Maintained turn effect source binding is stale.')
    const terminatesWhenEmpty =
      state.descriptor.schemaVersion === 1 ||
      state.descriptor.emptyDependentPolicy === 'TERMINATE_WHEN_EMPTY'
    if (
      !terminatesWhenEmpty ||
      (await store.listDependentEffects({ encounterId: input.state.id, stateId })).length !== 0
    )
      continue
    await store.deleteMaintainedStateCas({
      id: state.id,
      encounterId: input.state.id,
      ownerActorId: state.ownerActorId,
      expectedVersion: state.version
    })
    terminatedMaintainedStates.push({
      id: state.id,
      ownerActorId: state.ownerActorId,
      maintenanceDefinitionId: state.maintenanceDefinitionId,
      expectedVersion: state.version,
      descriptorChecksum: state.descriptorChecksum
    })
  }
  terminatedMaintainedStates.sort((left, right) =>
    `${left.ownerActorId}:${left.id}`.localeCompare(`${right.ownerActorId}:${right.id}`)
  )
  const applied = await applyEncounterMechanicsBatch(
    ctx,
    batch,
    target.characterFacts?.sourceContext
  )
  if (
    !same(applied.updatedActor, planned.updatedActor) ||
    !same(applied.targetTransition, planned.targetTransition) ||
    !same(applied.receiptApplications, planned.receiptApplications) ||
    applied.characterStreamVersion !== planned.characterStreamVersion
  )
    throw new Error('Turn effect settlement differs from its plan.')
  const actor = target.actor
  return {
    actors: [applied.updatedActor],
    result: storedRuleExecutionResultDtoSchema.parse({
      status: 'BATCH_COMPLETE',
      batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      encounterId: input.state.id,
      commandType,
      ...(terminatedMaintainedStates.length ? { terminatedMaintainedStates } : {}),
      executions: evaluated.plan.executions,
      characterTransitions:
        actor.kind === 'CHARACTER' && batch.expectedCharacterStreamVersion !== null
          ? [
              {
                characterId: actor.sourceId,
                targetActorId: actor.id,
                beforeStreamVersion: batch.expectedCharacterStreamVersion,
                afterStreamVersion: applied.characterStreamVersion,
                before: applied.targetTransition.before,
                after: applied.targetTransition.after
              }
            ]
          : [],
      encounterActorTransitions:
        actor.kind !== 'CHARACTER'
          ? [
              {
                targetActorId: actor.id,
                before: applied.targetTransition.before,
                after: applied.targetTransition.after
              }
            ]
          : []
    })
  }
}
