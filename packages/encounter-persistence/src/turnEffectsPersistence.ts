import {
  isSaveTallyStep,
  isTurnEffectEligible,
  requireTurnMaintainedStates,
  turnEffectDamageEnded,
  turnEffectOwner,
  turnEffectRetainedConditions,
  turnEffectSelectionChecksum,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  deriveEncounterCharacterMechanicsEventCommandId,
  targetTransitionChecksum
} from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { turnEndGateChildEffect } from '@artificer-toolkit/rules-runtime/encounterEffectTurnEndGate'
import type { CharacterRuleActionApplication } from '@artificer-toolkit/rules-runtime/characterRuleActionSystemAdapter'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  storedRuleExecutionResultDtoSchema,
  type PendingCompletedTurnPhaseDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  ENDED_EFFECT_RELEASE_OPERATION_KEY,
  isEndedEffectRelease
} from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import {
  endedEffectReleaseKey,
  expiredEffectReleases
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readRunActor, readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/** Persists one closed DO turn-effect phase inside the owning terminal transaction. */
export async function persistEncounterTurnEffects(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    userId: string
    occurrenceId: string
    occurrenceVersion: number
    rootCommandId: string
    occurredAt: string
    boundary: TurnEffectBoundary
    phase: PendingCompletedTurnPhaseDto
  },
  applyMechanics: (
    input: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
  ) => Promise<EncounterMechanicsBatchResult>
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
          occurrenceVersion: 1
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
  const maintainedStates = await requireTurnMaintainedStates(
    state.id,
    actor,
    candidates,
    (stateId) => store.findMaintainedStateById({ encounterId: state.id, stateId })
  )
  const expired = new Set<string>()
  // Effects an earlier execution's damage ended; a candidate among them expires at its own turn.
  const damageEnded = new Map<string, ActiveRuleEffectRecord>()
  const dispositions = new Map(
    executions.some(({ applications }) => applications.some(({ kind }) => kind === 'DAMAGE'))
      ? (await readRunActors(ctx, state)).map(({ id, disposition }) => [id, disposition] as const)
      : []
  )
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
            checksumRuleDocument({
              ...effect.lifecycle,
              remainingTicks: afterRemainingTicks,
              ...(lifecycle.afterSaveTally ? { saveTally: lifecycle.afterSaveTally } : {})
            }) ||
          !isSaveTallyStep(
            effect.lifecycle.saveTally,
            lifecycle.afterSaveTally,
            recurrence.saveThresholds
          ))) ||
      (lifecycle.kind === 'EXPIRE' &&
        lifecycle.afterRemainingTicks !== (remaining === null ? null : 0))
    )
      throw new Error('Staged turn effect lifecycle is invalid.')
    const transition = execution.targetTransition
    if (
      transition.checksum !== targetTransitionChecksum(actor.id, transition.before) ||
      (priorAfter !== null && !same(transition.before, priorAfter)) ||
      execution.applications.some(
        (application, index) =>
          application.ordinal !== index ||
          (application.sourceOperationKey !== ENDED_EFFECT_RELEASE_OPERATION_KEY &&
            (application.sourceNodeId !== definition.frozenGraphNodeId ||
              ![
                'HEAL',
                'TEMPORARY_HIT_POINTS',
                'DAMAGE',
                'CONDITION_APPLY',
                'CONDITION_REMOVE'
              ].includes(application.kind) ||
              (application.kind === 'CONDITION_REMOVE' &&
                application.sourceActiveEffectId !== effect.id)))
      )
    )
      throw new Error('Staged turn effect target transition is invalid.')
    // The damage this execution dealt ends the holder's other damage-triggered effects; the plan
    // must have released exactly the conditions only they held, and an expiring effect's own
    // temporary hit points (D156).
    const ended = turnEffectDamageEnded({
      effect,
      holderActorId: actor.id,
      held: effects,
      excluded: new Set([
        ...damageEnded.keys(),
        ...candidates.slice(0, ordinal + 1).map(({ id }) => id)
      ]),
      testEvidence: [execution.d20],
      applications: execution.applications.map((application) => ({
        ...application,
        targetActorId: actor.id
      })),
      dispositions
    })
    if (
      !same(
        execution.applications.flatMap((application) =>
          application.sourceOperationKey === ENDED_EFFECT_RELEASE_OPERATION_KEY &&
          isEndedEffectRelease(application)
            ? [endedEffectReleaseKey(application)]
            : []
        ),
        [
          ...ended.releases,
          ...(lifecycle.kind === 'EXPIRE' ? expiredEffectReleases(effect, actor.id) : [])
        ].map(endedEffectReleaseKey)
      )
    )
      throw new Error('Staged turn effect damage release is stale.')
    if (damageEnded.has(effect.id) && lifecycle.kind !== 'EXPIRE')
      throw new Error('Staged turn effect damage expiry is stale.')
    for (const endedEffect of ended.endedEffects) damageEnded.set(endedEffect.id, endedEffect)
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
  let beforeStreamVersion: number | null = null
  if (actor.kind === 'CHARACTER') {
    const row = await ctx.ports.readCharacterRow(actor.sourceId)
    if (!row || row.status !== 'ACTIVE' || row.systemId !== state.gameSystemId)
      throw new Error('Live Session Character changed.')
    beforeStreamVersion = row.play.streamVersion
  }
  const applied = await applyMechanics({
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
        expectedVersion: effect.version,
        removal: 'ENDED'
      })
    } else {
      await store.updateLifecycleCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        lifecycle: {
          ...effect.lifecycle,
          remainingTicks: execution.lifecycle.afterRemainingTicks,
          ...(execution.lifecycle.afterSaveTally
            ? { saveTally: execution.lifecycle.afterSaveTally }
            : {})
        }
      })
      // A passed turn-end gate gives the holder its child effect until their next turn starts.
      const child =
        execution.d20?.resultPath === 'ON_SAVE_SUCCESS' ? turnEndGateChildEffect(effect) : null
      if (child) await store.create({ ...child, occurredAt: input.occurredAt })
    }
  }
  // A candidate the damage ended has already expired with its own execution.
  const candidateIds = new Set(candidates.map(({ id }) => id))
  const damageDeleted = [...damageEnded.values()].filter(({ id }) => !candidateIds.has(id))
  const endedMaintainedStates = await requireTurnMaintainedStates(
    state.id,
    actor,
    damageDeleted,
    (stateId) => store.findMaintainedStateById({ encounterId: state.id, stateId })
  )
  for (const endedEffect of damageDeleted) {
    if (endedEffect.maintainedEffectStateId !== null)
      terminalMaintainedStateIds.add(endedEffect.maintainedEffectStateId)
    await store.deleteCas({
      id: endedEffect.id,
      owner,
      expectedVersion: endedEffect.version,
      removal: 'ENDED'
    })
  }
  const terminatedMaintainedStates = []
  for (const stateId of [...terminalMaintainedStateIds].sort()) {
    const maintained = maintainedStates.get(stateId) ?? endedMaintainedStates.get(stateId)
    if (!maintained) throw new Error('Maintained turn effect source binding is stale.')
    if (
      maintained.descriptor.emptyDependentPolicy !== 'TERMINATE_WHEN_EMPTY' ||
      (await store.hasDependents({ encounterId: state.id, stateId }))
    )
      continue
    await store.deleteMaintainedStateCas({
      id: maintained.id,
      encounterId: state.id,
      ownerActorId: maintained.ownerActorId,
      expectedVersion: maintained.version,
      removal: 'ENDED'
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
