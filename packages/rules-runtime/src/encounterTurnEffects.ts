import {
  executeTargetBoundActiveRuleEffectWithPause,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithPause,
  verifyTargetBoundActiveRuleEffectContinuation,
  type TargetBoundActiveRuleEffectExecutionResult,
  type TargetBoundActiveRuleEffectExecutionInput
} from './targetBoundActiveRuleEffectExecutor.js'
import {
  deriveEncounterCharacterMechanicsEventCommandId,
  foldCharacterMechanicsApplications,
  targetTransitionChecksum
} from './encounterCharacterMechanicsBatch.js'
import { encounterActorBody } from './encounterActorBody.js'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import {
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveEffectSaveTally } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  storedRuleExecutionResultDtoSchema,
  type PendingCompletedTurnPhaseDto,
  type StagedTurnEffectPlanDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from './encounterMechanicsBatchPlan.js'
import { planEncounterMechanicsBatch } from './encounterMechanicsBatchPlan.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import { encounterConditionSaveAutoFailAbilityIds } from './encounterConditionMechanics.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { expiredEffectReleases } from './encounterEndedEffectRelease.js'
import { rebuildEncounterTurnTarget } from './encounterTurnTarget.js'
import { sourceActorIdOf } from './events/encounterEventHooks.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  isTurnEffectEligible,
  requireTurnMaintainedStates,
  turnEffectDamageEnded,
  turnEffectOwner,
  turnEffectRetainedConditions,
  turnEffectSelectionChecksum,
  type TurnEffectBoundary
} from './encounterTurnEffectState.js'
import { settleEncounterD20Answer } from './encounterD20Settlement.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

type TurnExecution = StagedTurnEffectPlanDto['executions'][number]
type TurnPending = Extract<
  ServerRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
>

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

function targetChecksum(
  target: MovementTarget,
  state: {
    current: number
    temporary: number
    conditions: readonly string[]
    scalarValues: Readonly<Record<string, number>>
  }
) {
  return checksumRuleDocument({
    targetActorId: target.actor.id,
    currentHitPoints: state.current,
    temporaryHitPoints: state.temporary,
    maximumHitPoints: target.effectiveMaximumHitPoints,
    scalarValues: state.scalarValues,
    conditionIds: state.conditions
  })
}

function pendingCandidate(input: {
  ordinal: number
  boundary: TurnEffectBoundary
  target: MovementTarget
  effect: ActiveRuleEffectRecord
  state: ReturnType<typeof executionState>
  d20Policy?: unknown
}) {
  const currentness = input.target.characterCurrentness
  return {
    ordinal: input.ordinal,
    boundaryOrdinal: input.boundary.ordinal,
    stage: input.boundary.stage,
    targetActorId: input.target.actor.id,
    owner:
      currentness && input.target.actor.kind === 'CHARACTER' && input.target.characterFacts
        ? {
            kind: 'CHARACTER' as const,
            characterId: input.target.actor.sourceId,
            streamVersion: input.target.characterFacts.active.play.streamVersion,
            projectionChecksum: currentness.projectionChecksum,
            mechanicalContextChecksum: currentness.mechanicalContextChecksum
          }
        : { kind: 'ENCOUNTER_ACTOR' as const },
    activeEffectId: input.effect.id,
    createdOrdinal: input.effect.createdOrdinal,
    effectVersion: input.effect.version,
    definitionChecksum: input.effect.definitionChecksum,
    lifecycleChecksum: input.effect.lifecycleChecksum,
    targetStateChecksum: targetChecksum(input.target, input.state),
    d20Policy: input.d20Policy ?? null
  }
}

function executionState(
  target: Pick<MovementTarget, 'state' | 'characterFacts' | 'effectiveScalarValues'>
) {
  return {
    current: target.state.current,
    temporary: target.state.temporary,
    temporarySourceEffectId: target.state.temporarySourceEffectId ?? null,
    conditions: [...target.state.conditions],
    deathSaves: target.state.deathSaves,
    ownConditions: target.characterFacts
      ? (target.characterFacts.character.state.conditions ?? []).map(
          (condition) => condition.conditionTypeId
        )
      : [...target.state.conditions],
    scalarValues: { ...target.effectiveScalarValues }
  }
}

/** The target facts a target-bound active effect executes against, from the holder's state. */
export function activeEffectTargetFacts(
  target: Pick<
    MovementTarget,
    | 'actor'
    | 'state'
    | 'characterFacts'
    | 'effectiveScalarValues'
    | 'effectiveMaximumHitPoints'
    | 'targetDerivedFacts'
    | 'defenses'
    | 'conditionImmunityIds'
    | 'incomingDamage'
    | 'sourceConditionImmunities'
    | 'sourceSaves'
    | 'conditionMechanics'
  >,
  state: ReturnType<typeof executionState> = executionState(target)
) {
  return {
    targetActorId: target.actor.id,
    currentHitPoints: state.current,
    temporaryHitPoints: state.temporary,
    maximumHitPoints: target.effectiveMaximumHitPoints,
    targetScalarValues: state.scalarValues,
    targetConditionIds: state.conditions,
    targetDerivedFacts: target.targetDerivedFacts,
    defenses: target.defenses,
    conditionImmunityIds: target.conditionImmunityIds,
    incomingHalved: target.incomingDamage.halved,
    sourceConditionImmunities: target.sourceConditionImmunities,
    sourceSaves: target.sourceSaves,
    conditionOutcomeRules: {
      hitIsCritical: false,
      saveAutoFailAbilityIds: encounterConditionSaveAutoFailAbilityIds(target.conditionMechanics)
    }
  }
}

function lifecycle(
  effect: ActiveRuleEffectRecord,
  terminal: boolean,
  saveTally?: ActiveEffectSaveTally
) {
  const remaining = effect.lifecycle.remainingTicks
  if (terminal || remaining === 1)
    return {
      kind: 'EXPIRE' as const,
      expectedVersion: effect.version,
      beforeRemainingTicks: remaining,
      afterRemainingTicks: remaining === null ? null : (0 as const),
      beforeLifecycleChecksum: effect.lifecycleChecksum
    }
  const afterRemainingTicks = remaining === null ? null : remaining - 1
  return {
    kind: 'UPDATE' as const,
    expectedVersion: effect.version,
    afterVersion: effect.version + 1,
    beforeRemainingTicks: remaining,
    afterRemainingTicks,
    ...(saveTally ? { afterSaveTally: saveTally } : {}),
    beforeLifecycleChecksum: effect.lifecycleChecksum,
    afterLifecycleChecksum: checksumRuleDocument({
      ...effect.lifecycle,
      remainingTicks: afterRemainingTicks,
      ...(saveTally ? { saveTally } : {})
    })
  }
}

function requirePending(pending: ServerRuleExecutionPendingSnapshotDto): {
  context: TurnPending
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
} {
  if (
    pending.snapshotKind !== 'KERNEL_EVIDENCE' ||
    pending.applicationContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
  )
    throw new Error('The pending occurrence is not turn-effect evidence.')
  return { context: pending.applicationContext, snapshot: pending }
}

export function kernelContinuation(snapshot: ServerKernelRuleExecutionPendingSnapshotDto) {
  const {
    snapshotKind: _snapshotKind,
    optionalCombatSnapshotChecksum: _optional,
    applicationContext: _context,
    ...continuation
  } = snapshot
  return continuation
}

function overlayEffects(
  effects: readonly ActiveRuleEffectRecord[],
  prior?: PendingCompletedTurnPhaseDto
) {
  if (prior?.kind !== 'STAGED') return [...effects]
  return effects.flatMap((effect) => {
    const execution = prior.plan.executions.find((entry) => entry.activeEffectId === effect.id)
    if (!execution) return [effect]
    if (
      effect.version !== execution.beforeVersion ||
      effect.definitionChecksum !== execution.definition.definitionChecksum ||
      effect.lifecycleChecksum !== execution.lifecycle.beforeLifecycleChecksum ||
      effect.lifecycle.remainingTicks !== execution.lifecycle.beforeRemainingTicks ||
      execution.lifecycle.expectedVersion !== effect.version
    )
      throw new Error('Prior turn effect lifecycle is stale.')
    if (execution.lifecycle.kind === 'EXPIRE') return []
    return [
      {
        ...effect,
        version: execution.lifecycle.afterVersion,
        lifecycle: {
          ...effect.lifecycle,
          remainingTicks: execution.lifecycle.afterRemainingTicks,
          ...(execution.lifecycle.afterSaveTally
            ? { saveTally: execution.lifecycle.afterSaveTally }
            : {})
        },
        lifecycleChecksum: execution.lifecycle.afterLifecycleChecksum
      }
    ]
  })
}

function completeExecution(input: {
  ordinal: number
  boundary: TurnEffectBoundary
  target: MovementTarget
  effect: ActiveRuleEffectRecord
  state: ReturnType<typeof executionState>
  retainedConditionIds: readonly string[]
  result: TargetBoundActiveRuleEffectExecutionResult
}): { execution: TurnExecution; ownConditions: string[] } {
  const { target, effect, result } = input
  const folded = foldCharacterMechanicsApplications({
    targetActorId: target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    temporaryHitPointsSourceEffectId: input.state.temporarySourceEffectId ?? null,
    maximumHitPoints: target.effectiveMaximumHitPoints,
    deathSaves: input.state.deathSaves,
    scalarValues: input.state.scalarValues,
    conditionIds: input.state.conditions,
    retainedConditionIds: input.retainedConditionIds,
    invulnerable: encounterActorBody(target.actor).invulnerable,
    layers: {
      ownConditionIds: input.state.ownConditions,
      campaignConditionIds: (target.characterFacts?.campaignContext.conditions ?? []).map(
        (condition) => condition.conditionTypeId
      )
    },
    applications: result.applications
  })
  const sourceActorId = sourceActorIdOf(effect)
  const execution: TurnExecution = {
    ordinal: input.ordinal,
    boundaryOrdinal: input.boundary.ordinal,
    stage: input.boundary.stage,
    targetActorId: target.actor.id,
    owner:
      target.actor.kind === 'CHARACTER' && target.actor.sourceId
        ? { kind: 'CHARACTER', characterId: target.actor.sourceId }
        : { kind: 'ENCOUNTER_ACTOR' },
    activeEffectId: effect.id,
    ...(sourceActorId ? { damagerActorId: sourceActorId } : {}),
    createdOrdinal: effect.createdOrdinal,
    beforeVersion: effect.version,
    definition: {
      authoredEffectId: effect.definition.authoredEffectId,
      compiledEntryId: effect.definition.compiledEntryId,
      frozenGraphNodeId: effect.definition.frozenGraphNodeId,
      frozenSourceChecksum: effect.definition.frozenGraph.source.checksum,
      capabilityContractVersion: effect.definition.frozenGraph.capabilityContractVersion,
      definitionChecksum: effect.definitionChecksum
    },
    execution: result.execution,
    d20: result.d20,
    targetTransition: {
      checksum: targetTransitionChecksum(target.actor.id, folded.before),
      before: folded.before,
      after: folded.after
    },
    applications: folded.applications,
    lifecycle: lifecycle(effect, result.terminal, result.saveTally)
  }
  return { execution, ownConditions: folded.afterOwnConditionIds }
}

async function evaluateEncounterTurnEffects(input: {
  createRuntime: () => Promise<RulesRuntimeService>
  random: (maxExclusive: number) => number
  resolvePerception: (input: {
    actors: EncounterRunActorState[]
    target: MovementTarget
    targets: ReadonlyMap<string, MovementTarget>
    effect: ActiveRuleEffectRecord
  }) => Promise<TargetBoundActiveRuleEffectExecutionInput['perception']>
  state: EncounterRunState
  userId: string
  /** The turn actor's roller preference; its controllers roll its turn-effect saves. */
  autoRoll: boolean
  occurrenceId: string
  actors: EncounterRunActorState[]
  boundary: TurnEffectBoundary
  target: MovementTarget
  targets: ReadonlyMap<string, MovementTarget>
  effects: ActiveRuleEffectRecord[]
  candidates: ActiveRuleEffectRecord[]
  selectionChecksum: string
  root?: TurnCoordinatorRootDto
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: EncounterResponseAnswer
  retainedPlan?: StagedTurnEffectPlanDto
}) {
  const retained = input.pending ? requirePending(input.pending) : null
  const pending = retained?.context
  if (
    pending &&
    (input.state.automationMode === 'MANUAL' ||
      !same(pending.root, input.root) ||
      pending.selectionChecksum !== input.selectionChecksum ||
      pending.completedExecutions.length !== pending.currentCandidate.ordinal ||
      pending.completedExecutions.length + pending.remainingCandidates.length + 1 !==
        input.candidates.length)
  )
    throw new Error('Turn effect evidence is stale.')
  if (
    input.retainedPlan &&
    (input.retainedPlan.selectionChecksum !== input.selectionChecksum ||
      input.retainedPlan.executions.length !== input.candidates.length)
  )
    throw new Error('Retained turn effect selection is stale.')
  if (pending && input.retainedPlan) throw new Error('Turn effect evidence is ambiguous.')
  // Check the entire issued suffix before consuming any new random evidence.
  if (pending) {
    for (const expected of [pending.currentCandidate, ...pending.remainingCandidates]) {
      const effect = input.candidates[expected.ordinal]
      if (!effect) throw new Error('Turn effect candidate is stale.')
      const actual = pendingCandidate({
        ordinal: expected.ordinal,
        boundary: input.boundary,
        target: input.target,
        effect,
        state: executionState(input.target),
        d20Policy: expected.ordinal === pending.currentCandidate.ordinal ? expected.d20Policy : null
      })
      if (!same({ ...actual, targetStateChecksum: expected.targetStateChecksum }, expected))
        throw new Error('Turn effect candidate is stale.')
    }
  }
  const runtime = await input.createRuntime()
  const executions: TurnExecution[] = []
  const applications: CharacterRuleActionApplication[] = []
  const expired = new Set<string>()
  // Effects an earlier execution's damage ended; a candidate among them expires at its own turn.
  const damageEnded = new Set<string>()
  const dispositions = new Map(input.actors.map(({ id, disposition }) => [id, disposition]))
  let state = executionState(input.target)
  for (const [ordinal, effect] of input.candidates.entries()) {
    if (effect.definition.frozenGraph.source.gameSystemId !== input.state.gameSystemId)
      throw new Error('Turn effect Game System is stale.')
    const recurrence = effect.definition.recurrence
    if (
      (recurrence.expiration.kind === 'TICKS' &&
        (recurrence.expiration.decrementStage !== input.boundary.stage ||
          effect.lifecycle.remainingTicks === null ||
          effect.lifecycle.remainingTicks < 1)) ||
      (recurrence.expiration.kind === 'INDEFINITE' && effect.lifecycle.remainingTicks !== null) ||
      !Number.isSafeInteger(effect.version + 1)
    )
      throw new Error('Turn effect recurrence is unsupported.')
    const effectInput: TargetBoundActiveRuleEffectExecutionInput = {
      activeEffectId: effect.id,
      activeEffectVersion: effect.version,
      definition: effect.definition,
      lifecycle: effect.lifecycle,
      lifecycleChecksum: effect.lifecycleChecksum,
      occurrenceId: input.occurrenceId,
      ...activeEffectTargetFacts(input.target, state),
      perception: await input.resolvePerception({
        actors: input.actors,
        target: input.target,
        targets: input.targets,
        effect
      }),
      runtime
    }
    const existing =
      input.retainedPlan?.executions[ordinal] ??
      (pending && ordinal < pending.currentCandidate.ordinal
        ? pending.completedExecutions[ordinal]
        : undefined)
    if (
      existing &&
      (!same(existing.execution.evidence.source, effect.definition.frozenGraph.source) ||
        !same(
          existing.execution.evidence.sourceEntryBindings ?? [],
          effect.definition.frozenGraph.sourceEntryBindings ?? []
        ))
    )
      throw new Error('Retained turn effect source bindings are stale.')
    const resuming = pending && ordinal === pending.currentCandidate.ordinal
    if (
      resuming &&
      !same(
        pendingCandidate({
          ordinal,
          boundary: input.boundary,
          target: input.target,
          effect,
          state,
          d20Policy: pending.currentCandidate.d20Policy
        }),
        pending.currentCandidate
      )
    )
      throw new Error('Turn effect target evidence is stale.')
    let result = existing
      ? reconstructTargetBoundActiveRuleEffectCompletion({
          executionInput: effectInput,
          execution: existing.execution,
          d20Evidence: existing.d20
        })
      : resuming
        ? await (async () => {
            const continuation = kernelContinuation(retained!.snapshot)
            verifyTargetBoundActiveRuleEffectContinuation({
              ...effectInput,
              continuation,
              expectedEvidencePolicy: pending.currentCandidate.d20Policy
            })
            const resolution = input.resolution
            if (resolution?.kind !== 'ENTER_DICE' && resolution?.kind !== 'SYSTEM_ROLL')
              throw new Error('Turn effect d20 evidence is required.')
            const policy = pending.currentCandidate.d20Policy
            if (resolution.requestId !== continuation.request.requestId || !policy)
              throw new Error('Turn effect d20 request is stale.')
            const { rawFaces, rollMode, keep, addedDice } = settleEncounterD20Answer({
              gameSystemId: input.state.gameSystemId,
              d20: policy,
              answer: resolution,
              rollD20: () => input.random(20) + 1,
              random: input.random
            })
            return resumeTargetBoundActiveRuleEffectWithPause({
              ...effectInput,
              continuation,
              resolution: { requestId: resolution.requestId, rawFaces, rollMode, keep, addedDice },
              expectedEvidencePolicy: policy
            })
          })()
        : await executeTargetBoundActiveRuleEffectWithPause(effectInput)
    if ('continuation' in result && input.autoRoll) {
      if (!result.evidencePolicy) throw new Error('Automatic turn effect has no d20 policy.')
      const answer = {
        kind: 'AUTO_ROLL' as const,
        requestId: result.continuation.request.requestId
      }
      const { rawFaces, rollMode, keep, addedDice } = settleEncounterD20Answer({
        gameSystemId: input.state.gameSystemId,
        d20: result.evidencePolicy,
        answer,
        rollD20: () => input.random(20) + 1,
        random: input.random
      })
      result = await resumeTargetBoundActiveRuleEffectWithPause({
        ...effectInput,
        continuation: result.continuation,
        resolution: { requestId: answer.requestId, rawFaces, rollMode, keep, addedDice },
        expectedEvidencePolicy: result.evidencePolicy
      })
      if ('continuation' in result) throw new Error('Automatic turn effect did not complete.')
    }
    if ('continuation' in result) {
      if (!input.root) throw new Error('Turn effect reconstruction requested new evidence.')
      return {
        kind: 'PENDING' as const,
        snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...result.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          applicationContext: {
            kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
            schemaVersion: 1,
            root: input.root,
            selectionChecksum: input.selectionChecksum,
            currentCandidate: pendingCandidate({
              ordinal,
              boundary: input.boundary,
              target: input.target,
              effect,
              state,
              d20Policy: result.evidencePolicy
            }),
            completedExecutions: executions,
            remainingCandidates: input.candidates.slice(ordinal + 1).map((remaining, offset) =>
              pendingCandidate({
                ordinal: ordinal + offset + 1,
                boundary: input.boundary,
                target: input.target,
                effect: remaining,
                state
              })
            )
          }
        })
      }
    }
    const ended = turnEffectDamageEnded({
      effect,
      holderActorId: input.target.actor.id,
      held: input.effects,
      excluded: new Set([
        ...damageEnded,
        ...input.candidates.slice(0, ordinal + 1).map(({ id }) => id)
      ]),
      testEvidence: [result.d20],
      applications: result.applications,
      dispositions
    })
    // An effect ends with the one it links to (D172), which an earlier candidate already ended:
    // effects are made, and so run, in the order they link.
    const linkedId = effect.definition.linkedEffectId
    const terminal =
      result.terminal ||
      damageEnded.has(effect.id) ||
      (linkedId !== null && (expired.has(linkedId) || damageEnded.has(linkedId)))
    const settled = {
      ...result,
      terminal,
      applications: [
        ...result.applications,
        ...ended.releases,
        ...(lifecycle(effect, terminal).kind === 'EXPIRE'
          ? expiredEffectReleases(effect, input.target.actor.id)
          : [])
      ]
    }
    for (const { id } of ended.endedEffects) damageEnded.add(id)
    const { execution, ownConditions } = completeExecution({
      ordinal,
      boundary: input.boundary,
      target: input.target,
      effect,
      state,
      retainedConditionIds: turnEffectRetainedConditions(effect, input.effects, expired),
      result: settled
    })
    if (existing && !same(existing, execution))
      throw new Error('Retained turn effect execution is stale.')
    executions.push(execution)
    applications.push(...settled.applications)
    const after = execution.targetTransition.after
    state = {
      current: after.currentHitPoints,
      temporary: after.temporaryHitPoints,
      temporarySourceEffectId: after.temporaryHitPointsSourceEffectId ?? null,
      conditions: after.conditionIds,
      deathSaves: after.deathSaves,
      ownConditions,
      scalarValues: after.scalarValues
    }
    if (execution.lifecycle.kind === 'EXPIRE') expired.add(effect.id)
  }
  const retainedConditionIds = [
    ...new Set(
      input.candidates.flatMap((effect) =>
        turnEffectRetainedConditions(effect, input.effects, expired)
      )
    )
  ].sort()
  return {
    kind: 'COMPLETE' as const,
    plan: { selectionChecksum: input.selectionChecksum, executions },
    applications,
    retainedConditionIds
  }
}

function turnEffectMechanicsBatch(input: {
  state: EncounterRunState
  occurrenceId: string
  rootCommandId: string
  occurredAt: string
  boundary: TurnEffectBoundary
  target: MovementTarget
  applications: readonly CharacterRuleActionApplication[]
  retainedConditionIds: readonly string[]
}): EncounterMechanicsBatchInput {
  const actor = input.target.actor
  return {
    encounterId: input.state.id,
    targetActorId: actor.id,
    expectedEncounterVersion: input.state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.rootCommandId,
    commandId:
      actor.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.rootCommandId,
            phase: 'TURN_EFFECT',
            ordinal: input.boundary.ordinal,
            targetCharacterId: actor.sourceId
          })
        : input.rootCommandId,
    occurredAt: input.occurredAt,
    applications: input.applications,
    expectedCharacterStreamVersion: input.target.characterFacts?.active.play.streamVersion ?? null,
    effectiveMaximumHitPoints: input.target.effectiveMaximumHitPoints,
    damageInterceptions: input.target.damageInterceptions,
    sheetMaximumHitPoints: input.target.sheetMaximumHitPoints,
    effectiveScalarValues: input.target.effectiveScalarValues,
    retainedConditionIds: input.retainedConditionIds,
    forceVersionAdvance: actor.kind === 'CHARACTER'
  }
}

/** Plans active effects without changing mechanics, lifecycles, or the Run. */
export async function prepareEncounterTurnEffects<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  state: EncounterRunState
  listEffects: (owner: ReturnType<typeof turnEffectOwner>) => Promise<ActiveRuleEffectRecord[]>
  loadMaintainedState: (stateId: string) => Promise<EncounterMaintainedEffectStateRecord | null>
  loadTarget: (actorId: string) => Promise<MovementTarget<TCharacterFacts> | undefined>
  createRuntime: () => Promise<RulesRuntimeService>
  random: (maxExclusive: number) => number
  resolvePerception: Parameters<typeof evaluateEncounterTurnEffects>[0]['resolvePerception']
  userId: string
  autoRoll: boolean
  root: TurnCoordinatorRootDto
  occurrenceId: string
  actors: EncounterRunActorState[]
  boundary: TurnEffectBoundary
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: EncounterResponseAnswer
  retainedPhase?: PendingCompletedTurnPhaseDto
  priorPlan?: PendingCompletedTurnPhaseDto
  movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
}): Promise<
  | { kind: 'PENDING'; snapshot: ServerRuleExecutionPendingSnapshotDto }
  | {
      kind: 'COMPLETE'
      actors: EncounterRunActorState[]
      movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      plan: StagedTurnEffectPlanDto | null
      phase: PendingCompletedTurnPhaseDto
    }
> {
  const targets = new Map(input.movementTargets)
  const none = () => {
    if (input.pending || (input.retainedPhase && input.retainedPhase.kind !== 'NONE'))
      throw new Error('Retained turn effect selection is stale.')
    return {
      kind: 'COMPLETE' as const,
      actors: input.actors,
      movementTargets: targets,
      plan: null,
      phase: { kind: 'NONE' as const }
    }
  }
  if (input.boundary.actorId === null) return none()
  const actor = input.actors.find((candidate) => candidate.id === input.boundary.actorId)
  if (!actor) throw new Error('Turn effect actor is unavailable.')
  const currentEffects = await input.listEffects(turnEffectOwner(actor, input.state.id))
  if (
    input.priorPlan?.kind === 'STAGED' &&
    input.priorPlan.plan.executions.some(
      (entry) =>
        entry.targetActorId === actor.id &&
        !currentEffects.some((effect) => effect.id === entry.activeEffectId)
    )
  )
    throw new Error('Prior turn effect selection is stale.')
  const effects = overlayEffects(currentEffects, input.priorPlan)
  const candidates = effects
    .filter((effect) => isTurnEffectEligible(effect, actor, input.state, input.boundary.stage))
    .sort(
      (left, right) => left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
    )
  if (!candidates.length) return none()
  if (
    candidates.length +
      (input.priorPlan?.kind === 'STAGED' ? input.priorPlan.plan.executions.length : 0) >
    128
  )
    throw new Error('A turn may execute at most 128 active effects.')
  const selected = turnEffectSelectionChecksum(
    input.root.commandType,
    input.boundary,
    actor,
    input.state.id,
    candidates
  )
  if (input.retainedPhase?.kind === 'NONE')
    throw new Error('Retained turn effect selection is stale.')
  if (input.state.automationMode === 'MANUAL') {
    const phase: PendingCompletedTurnPhaseDto = {
      kind: 'MANUAL',
      selectionChecksum: selected,
      result: storedRuleExecutionResultDtoSchema.parse({
        status: 'MANUAL',
        occurrenceId: input.occurrenceId,
        occurrenceVersion: 1
      })
    }
    if (input.pending || (input.retainedPhase && !same(phase, input.retainedPhase)))
      throw new Error('Retained manual turn effects are stale.')
    return {
      kind: 'COMPLETE',
      actors: input.actors,
      movementTargets: targets,
      plan: null,
      phase
    }
  }
  if (input.retainedPhase?.kind === 'MANUAL') throw new Error('Retained turn automation is stale.')
  await requireTurnMaintainedStates(input.state.id, actor, candidates, input.loadMaintainedState)
  let target = targets.get(actor.id)
  if (!target) target = await input.loadTarget(actor.id)
  if (!target) throw new Error('Turn effect target facts are unavailable.')
  // Root-owned transient facts may include earlier phase mechanics and resource refreshes.
  target = rebuildEncounterTurnTarget({
    source: target,
    actor,
    characterFacts: target.characterFacts,
    activeEffects: effects,
    state: input.state
  })
  targets.set(actor.id, target)
  const evaluated = await evaluateEncounterTurnEffects({
    ...input,
    target,
    targets,
    effects,
    candidates,
    selectionChecksum: selected,
    retainedPlan: input.retainedPhase?.kind === 'STAGED' ? input.retainedPhase.plan : undefined
  })
  if (evaluated.kind === 'PENDING') return evaluated
  const batch = turnEffectMechanicsBatch({
    ...input,
    target,
    rootCommandId: input.root.rootCommandId,
    occurredAt: target.characterFacts?.active.updatedAt ?? '1970-01-01T00:00:00.000Z',
    applications: evaluated.applications,
    retainedConditionIds: evaluated.retainedConditionIds
  })
  const mechanics = planEncounterMechanicsBatch({
    batch,
    actor,
    userId: input.userId,
    characterFacts: target.characterFacts ?? undefined
  })
  const first = evaluated.plan.executions[0]!
  const last = evaluated.plan.executions.at(-1)!
  if (
    !same(mechanics.targetTransition.before, first.targetTransition.before) ||
    !same(mechanics.targetTransition.after, last.targetTransition.after)
  )
    throw new Error('Grouped turn effect target transition is stale.')
  const projected = projectEncounterActionTarget({
    target,
    actor: mechanics.updatedActor,
    plan: mechanics,
    campaignId: input.state.campaignId,
    gameSystemId: input.state.gameSystemId,
    occurredAt: batch.occurredAt
  })
  // The next boundary observes expired/updated rows as well as staged target mechanics.
  targets.set(
    actor.id,
    rebuildEncounterTurnTarget({
      source: target,
      actor: projected.actor,
      characterFacts: projected.characterFacts,
      activeEffects: overlayEffects(effects, { kind: 'STAGED', plan: evaluated.plan }),
      state: input.state
    })
  )
  return {
    kind: 'COMPLETE',
    actors: input.actors.map((value) => (value.id === actor.id ? mechanics.updatedActor : value)),
    movementTargets: targets,
    plan: evaluated.plan,
    phase: { kind: 'STAGED', plan: evaluated.plan }
  }
}
