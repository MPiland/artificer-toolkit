import {
  isTurnEffectEligible,
  requireTurnMaintainedStates,
  turnEffectOwner,
  turnEffectRetainedConditions,
  turnEffectSelectionChecksum,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { CharacterRuleActionApplication } from '@artificer-toolkit/rules-runtime/characterRuleActionSystemAdapter'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  storedRuleExecutionResultDtoSchema,
  type PendingCompletedTurnPhaseDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx } from '../_generated/server'
import { readRunActor } from '../encounters/documents'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'
import { readLiveCharacterStreamVersion } from './encounterMovementTargetState'

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/** Persists one closed DO turn-effect phase inside the owning terminal transaction. */
export async function persistLiveTurnEffects(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    userId: string
    occurrenceId: string
    occurrenceVersion: number
    rootCommandId: string
    occurredAt: string
    boundary: TurnEffectBoundary
    phase: PendingCompletedTurnPhaseDto
  }
): Promise<{ result: StoredRuleExecutionResultDto | null; actors: EncounterRunActorState[] }> {
  const { state, boundary, phase } = input
  if (
    (boundary.ordinal !== 0 && boundary.ordinal !== 1) ||
    (boundary.stage !== 'START_OF_TURN' && boundary.stage !== 'END_OF_TURN')
  )
    throw new Error('Turn effect boundary is invalid.')
  if (boundary.actorId === null) {
    if (phase.kind !== 'NONE') throw new Error('Turn effect selection is stale.')
    return { result: null, actors: [] }
  }
  const actor = await readRunActor(ctx, state, boundary.actorId)
  const store = createActiveRuleEffectStore(ctx)
  const owner = turnEffectOwner(actor, state.id)
  const effects = await store.list(owner)
  const candidates = effects
    .filter((effect) => isTurnEffectEligible(effect, actor, state, boundary.stage))
    .sort(
      (left, right) => left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
    )
  if (phase.kind === 'NONE') {
    if (candidates.length) throw new Error('Turn effect selection is stale.')
    return { result: null, actors: [] }
  }
  if (!candidates.length || candidates.length > 128)
    throw new Error('Turn effect selection is unavailable.')
  const commandType = state.status === 'PREPARED' ? 'START' : 'ADVANCE_TURN'
  const selectionChecksum = turnEffectSelectionChecksum(
    commandType,
    boundary,
    actor,
    state.id,
    candidates
  )
  if (phase.kind === 'MANUAL') {
    if (
      state.automationMode !== 'MANUAL' ||
      phase.selectionChecksum !== selectionChecksum ||
      !same(
        phase.result,
        storedRuleExecutionResultDtoSchema.parse({
          status: 'MANUAL',
          occurrenceId: input.occurrenceId,
          occurrenceVersion: 1,
          reminder: { kind: 'MANUAL_RULE_REVIEW' }
        })
      )
    )
      throw new Error('Manual turn effect selection is stale.')
    return { result: phase.result, actors: [] }
  }
  if (state.automationMode === 'MANUAL' || phase.plan.selectionChecksum !== selectionChecksum)
    throw new Error('Staged turn effect selection is stale.')
  const executions = phase.plan.executions
  if (executions.length !== candidates.length || executions.length > 128)
    throw new Error('Staged turn effect selection is stale.')
  const maintainedStates = await requireTurnMaintainedStates(state.id, candidates, (stateId) =>
    store.findMaintainedStateById({ encounterId: state.id, stateId })
  )
  const expired = new Set<string>()
  const applications: CharacterRuleActionApplication[] = []
  let priorAfter: (typeof executions)[number]['targetTransition']['after'] | null = null
  for (const [ordinal, effect] of candidates.entries()) {
    const execution = executions[ordinal]!
    const definition = effect.definition
    const recurrence = definition.recurrence
    const lifecycle = execution.lifecycle
    const remaining = effect.lifecycle.remainingTicks
    if (
      execution.ordinal !== ordinal ||
      execution.boundaryOrdinal !== boundary.ordinal ||
      execution.stage !== boundary.stage ||
      execution.targetActorId !== actor.id ||
      !same(
        execution.owner,
        actor.kind === 'CHARACTER'
          ? { kind: 'CHARACTER', characterId: actor.sourceId }
          : { kind: 'ENCOUNTER_ACTOR' }
      ) ||
      execution.activeEffectId !== effect.id ||
      execution.createdOrdinal !== effect.createdOrdinal ||
      execution.beforeVersion !== effect.version ||
      lifecycle.expectedVersion !== effect.version ||
      lifecycle.beforeRemainingTicks !== remaining ||
      lifecycle.beforeLifecycleChecksum !== effect.lifecycleChecksum ||
      !same(execution.definition, {
        authoredEffectId: definition.authoredEffectId,
        compiledEntryId: definition.compiledEntryId,
        frozenGraphNodeId: definition.frozenGraphNodeId,
        frozenSourceChecksum: definition.frozenGraph.source.checksum,
        capabilityContractVersion: definition.frozenGraph.capabilityContractVersion,
        definitionChecksum: effect.definitionChecksum
      }) ||
      !same(execution.execution.evidence.source, definition.frozenGraph.source) ||
      !same(
        execution.execution.evidence.sourceEntryBindings ?? [],
        definition.frozenGraph.sourceEntryBindings ?? []
      ) ||
      definition.frozenGraph.source.gameSystemId !== state.gameSystemId ||
      recurrence.consumeOnFirstEvent !== null ||
      recurrence.endOnEvents.length !== 0 ||
      (recurrence.expiration.kind === 'TICKS' &&
        (recurrence.expiration.decrementStage !== boundary.stage ||
          remaining === null ||
          remaining < 1)) ||
      (recurrence.expiration.kind === 'INDEFINITE' && remaining !== null) ||
      !Number.isSafeInteger(effect.version + 1)
    )
      throw new Error('Staged turn effect currentness is stale.')
    const afterRemainingTicks = remaining === null ? null : remaining - 1
    if (
      (lifecycle.kind === 'UPDATE' &&
        (remaining === 1 ||
          lifecycle.afterVersion !== effect.version + 1 ||
          lifecycle.afterRemainingTicks !== afterRemainingTicks ||
          lifecycle.afterLifecycleChecksum !==
            checksumRuleDocument({ schemaVersion: 1, remainingTicks: afterRemainingTicks }))) ||
      (lifecycle.kind === 'EXPIRE' &&
        lifecycle.afterRemainingTicks !== (remaining === null ? null : 0))
    )
      throw new Error('Staged turn effect lifecycle is invalid.')
    const transition = execution.targetTransition
    if (
      transition.checksum !==
        checksumRuleDocument({ targetActorId: actor.id, ...transition.before }) ||
      (priorAfter !== null && !same(transition.before, priorAfter)) ||
      execution.applications.some(
        (application, index) =>
          application.ordinal !== index ||
          application.sourceNodeId !== definition.frozenGraphNodeId ||
          ![
            'HEAL',
            'TEMPORARY_HIT_POINTS',
            'DAMAGE',
            'CONDITION_APPLY',
            'CONDITION_REMOVE'
          ].includes(application.kind) ||
          (application.kind === 'CONDITION_REMOVE' &&
            application.sourceActiveEffectId !== effect.id)
      )
    )
      throw new Error('Staged turn effect target transition is invalid.')
    priorAfter = transition.after
    applications.push(
      ...execution.applications.map(({ ordinal: _ordinal, ...application }) => ({
        ...application,
        targetActorId: actor.id
      }))
    )
    if (lifecycle.kind === 'EXPIRE') expired.add(effect.id)
  }
  const first = executions[0]!
  const last = executions.at(-1)!
  const retainedConditionIds = [
    ...new Set(
      candidates.flatMap((effect) => turnEffectRetainedConditions(effect, effects, expired))
    )
  ].sort()
  // The turn admission's revision fence pins this to the room's captured Character.
  const beforeStreamVersion =
    actor.kind === 'CHARACTER'
      ? await readLiveCharacterStreamVersion(ctx, state, actor.sourceId)
      : null
  const applied = await applyLiveEncounterMechanicsBatch(ctx, {
    encounterId: state.id,
    targetActorId: actor.id,
    expectedEncounterVersion: state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.rootCommandId,
    commandId:
      actor.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.rootCommandId,
            phase: 'TURN_EFFECT',
            ordinal: boundary.ordinal,
            targetCharacterId: actor.sourceId
          })
        : input.rootCommandId,
    occurredAt: input.occurredAt,
    applications,
    effectiveMaximumHitPoints: first.targetTransition.before.maximumHitPoints,
    effectiveScalarValues: first.targetTransition.before.scalarValues,
    retainedConditionIds,
    forceVersionAdvance: actor.kind === 'CHARACTER'
  })
  let applicationOrdinal = 0
  const expectedApplications = executions.flatMap((execution) =>
    execution.applications.map((application) => ({ ...application, ordinal: applicationOrdinal++ }))
  )
  if (
    !same(applied.targetTransition.before, first.targetTransition.before) ||
    !same(applied.targetTransition.after, last.targetTransition.after) ||
    !same(applied.receiptApplications, expectedApplications) ||
    (beforeStreamVersion !== null && applied.characterStreamVersion !== beforeStreamVersion + 1)
  )
    throw new Error('Turn effect settlement differs from its plan.')
  const terminalMaintainedStateIds = new Set<string>()
  for (const [ordinal, execution] of executions.entries()) {
    const effect = candidates[ordinal]!
    if (execution.lifecycle.kind === 'EXPIRE') {
      if (effect.maintainedEffectStateId !== null)
        terminalMaintainedStateIds.add(effect.maintainedEffectStateId)
      await store.deleteCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version
      })
    } else
      await store.updateLifecycleCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: execution.lifecycle.afterRemainingTicks
        }
      })
  }
  const terminatedMaintainedStates = []
  for (const stateId of [...terminalMaintainedStateIds].sort()) {
    const maintained = maintainedStates.get(stateId)
    if (!maintained) throw new Error('Maintained turn effect source binding is stale.')
    const terminatesWhenEmpty =
      maintained.descriptor.schemaVersion === 1 ||
      maintained.descriptor.emptyDependentPolicy === 'TERMINATE_WHEN_EMPTY'
    if (
      !terminatesWhenEmpty ||
      (await store.listDependentEffects({ encounterId: state.id, stateId })).length !== 0
    )
      continue
    await store.deleteMaintainedStateCas({
      id: maintained.id,
      encounterId: state.id,
      ownerActorId: maintained.ownerActorId,
      expectedVersion: maintained.version
    })
    terminatedMaintainedStates.push({
      id: maintained.id,
      ownerActorId: maintained.ownerActorId,
      maintenanceDefinitionId: maintained.maintenanceDefinitionId,
      expectedVersion: maintained.version,
      descriptorChecksum: maintained.descriptorChecksum
    })
  }
  terminatedMaintainedStates.sort((left, right) =>
    `${left.ownerActorId}:${left.id}`.localeCompare(`${right.ownerActorId}:${right.id}`)
  )
  return {
    actors: [applied.updatedActor],
    result: storedRuleExecutionResultDtoSchema.parse({
      status: 'BATCH_COMPLETE',
      batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      encounterId: state.id,
      commandType,
      ...(terminatedMaintainedStates.length ? { terminatedMaintainedStates } : {}),
      executions,
      characterTransitions:
        actor.kind === 'CHARACTER'
          ? [
              {
                characterId: actor.sourceId,
                targetActorId: actor.id,
                beforeStreamVersion,
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
