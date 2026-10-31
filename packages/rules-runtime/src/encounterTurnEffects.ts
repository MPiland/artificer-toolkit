import {
  executeTargetBoundActiveRuleEffectWithPause,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithAnswer,
  verifyTargetBoundActiveRuleEffectContinuation,
  type TargetBoundActiveRuleEffectExecutionPaused,
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
import { encounterConditionSaveAutoFails } from './conditionSaveAutoFail.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { expiredEffectReleases } from './encounterEndedEffectRelease.js'
import { rebuildEncounterTurnTarget } from './encounterTurnTarget.js'
import { sourceActorIdOf } from './events/encounterEventHooks.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  requireTurnMaintainedStates,
  selectTurnEffectCandidates,
  turnEffectDamageEnded,
  turnEffectOwner,
  turnEffectRetainedConditions,
  turnEffectSelectionChecksum,
  type TurnEffectBoundary,
  type TurnEffectCandidate
} from './encounterTurnEffectState.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import {
  settleAutomaticSpatialEvidence,
  type SpatialD20Roll
} from './encounterSpatialCandidateExecution.js'

type TurnExecution = StagedTurnEffectPlanDto['executions'][number]
type TurnPending = Extract<
  ServerRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
>

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

type TurnEffectHolder = { target: MovementTarget; effects: ActiveRuleEffectRecord[] }

function holderOf(holders: ReadonlyMap<string, TurnEffectHolder>, candidate: TurnEffectCandidate) {
  const holder = holders.get(candidate.holder.id)
  if (!holder) throw new Error('Turn effect target facts are unavailable.')
  return holder
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
  /** The evidence a paused candidate waits on: its save's policy, then that save's resolved d20. */
  sealed?: Pick<TurnPending['currentCandidate'], 'd20Policy' | 'diceStage'> | null
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
    sourceActorId: sourceActorIdOf(input.effect) ?? null,
    d20Policy: input.sealed?.d20Policy ?? null,
    diceStage: input.sealed?.diceStage ?? null
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
      saveAutoFails: encounterConditionSaveAutoFails(target.conditionMechanics)
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
  /**
   * Each actor's roller preference: the turn actor's controllers roll its turn-effect saves, and
   * each effect's source's controllers roll its damage dice (ADR 0034 decision 3).
   */
  autoRollByActorId: EncounterAutoRollByActorId
  occurrenceId: string
  actors: EncounterRunActorState[]
  boundary: TurnEffectBoundary
  targets: ReadonlyMap<string, MovementTarget>
  /** Each candidate holder's rebuilt target and the effects it holds. */
  holders: ReadonlyMap<string, TurnEffectHolder>
  candidates: TurnEffectCandidate[]
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
      const candidate = input.candidates[expected.ordinal]
      if (!candidate) throw new Error('Turn effect candidate is stale.')
      const { target } = holderOf(input.holders, candidate)
      const actual = pendingCandidate({
        ordinal: expected.ordinal,
        boundary: input.boundary,
        target,
        effect: candidate.effect,
        state: executionState(target),
        sealed: expected.ordinal === pending.currentCandidate.ordinal ? expected : null
      })
      if (!same({ ...actual, targetStateChecksum: expected.targetStateChecksum }, expected))
        throw new Error('Turn effect candidate is stale.')
    }
  }
  const runtime = await input.createRuntime()
  const executions: TurnExecution[] = []
  const applications = new Map<string, CharacterRuleActionApplication[]>()
  const expired = new Set<string>()
  // Effects an earlier execution's damage ended; a candidate among them expires at its own turn.
  const damageEnded = new Set<string>()
  const dispositions = new Map(input.actors.map(({ id, disposition }) => [id, disposition]))
  // Each holder's state chains through its own executions only.
  const states = new Map(
    [...input.holders].map(([actorId, { target }]) => [actorId, executionState(target)])
  )
  for (const [ordinal, candidate] of input.candidates.entries()) {
    const { effect } = candidate
    const { target, effects } = holderOf(input.holders, candidate)
    const state = states.get(target.actor.id)!
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
      ...activeEffectTargetFacts(target, state),
      perception: await input.resolvePerception({
        actors: input.actors,
        target,
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
          target,
          effect,
          state,
          sealed: pending.currentCandidate
        }),
        pending.currentCandidate
      )
    )
      throw new Error('Turn effect target evidence is stale.')
    let result:
      | TargetBoundActiveRuleEffectExecutionResult
      | TargetBoundActiveRuleEffectExecutionPaused
    let d20: SpatialD20Roll | null = null
    if (existing) {
      result = reconstructTargetBoundActiveRuleEffectCompletion({
        executionInput: effectInput,
        execution: existing.execution,
        d20Evidence: existing.d20
      })
    } else if (resuming) {
      const continuation = kernelContinuation(retained!.snapshot)
      verifyTargetBoundActiveRuleEffectContinuation({
        ...effectInput,
        continuation,
        expectedEvidencePolicy: pending.currentCandidate.d20Policy
      })
      const answer = input.resolution
      if (
        answer?.kind !== 'ENTER_DICE' &&
        answer?.kind !== 'ENTER_INTEGER' &&
        answer?.kind !== 'SYSTEM_ROLL'
      )
        throw new Error('Turn effect evidence is required.')
      ;({ result, d20 } = await resumeTargetBoundActiveRuleEffectWithAnswer({
        effectInput,
        continuation,
        policy: pending.currentCandidate.d20Policy,
        diceStage: pending.currentCandidate.diceStage,
        answer,
        random: input.random
      }))
    } else {
      result = await executeTargetBoundActiveRuleEffectWithPause(effectInput)
    }
    if (!existing)
      ({ result, d20 } = await settleAutomaticSpatialEvidence({
        effectInput,
        candidate: {
          sourceActorId: sourceActorIdOf(effect) ?? null,
          targetActorId: target.actor.id
        },
        result,
        d20,
        autoRoll: input.autoRollByActorId,
        random: input.random
      }))
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
              target,
              effect,
              state,
              sealed: { d20Policy: result.evidencePolicy, diceStage: d20 }
            }),
            completedExecutions: executions,
            remainingCandidates: input.candidates.slice(ordinal + 1).map((remaining, offset) => {
              const holder = holderOf(input.holders, remaining)
              return pendingCandidate({
                ordinal: ordinal + offset + 1,
                boundary: input.boundary,
                target: holder.target,
                effect: remaining.effect,
                state: states.get(holder.target.actor.id)!
              })
            })
          }
        })
      }
    }
    const ended = turnEffectDamageEnded({
      effect,
      holderActorId: target.actor.id,
      held: effects,
      excluded: new Set([
        ...damageEnded,
        ...input.candidates.slice(0, ordinal + 1).map(({ effect: { id } }) => id)
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
          ? expiredEffectReleases(effect, target.actor.id)
          : [])
      ]
    }
    for (const { id } of ended.endedEffects) damageEnded.add(id)
    const { execution, ownConditions } = completeExecution({
      ordinal,
      boundary: input.boundary,
      target,
      effect,
      state,
      retainedConditionIds: turnEffectRetainedConditions(effect, effects, expired),
      result: settled
    })
    if (existing && !same(existing, execution))
      throw new Error('Retained turn effect execution is stale.')
    executions.push(execution)
    applications.set(target.actor.id, [
      ...(applications.get(target.actor.id) ?? []),
      ...settled.applications
    ])
    const after = execution.targetTransition.after
    states.set(target.actor.id, {
      current: after.currentHitPoints,
      temporary: after.temporaryHitPoints,
      temporarySourceEffectId: after.temporaryHitPointsSourceEffectId ?? null,
      conditions: after.conditionIds,
      deathSaves: after.deathSaves,
      ownConditions,
      scalarValues: after.scalarValues
    })
    if (execution.lifecycle.kind === 'EXPIRE') expired.add(effect.id)
  }
  return {
    kind: 'COMPLETE' as const,
    plan: { selectionChecksum: input.selectionChecksum, executions },
    settlements: [...applications].map(([actorId, targetApplications]) => ({
      actorId,
      applications: targetApplications,
      retainedConditionIds: [
        ...new Set(
          input.candidates.flatMap((candidate) =>
            candidate.holder.id === actorId
              ? turnEffectRetainedConditions(
                  candidate.effect,
                  holderOf(input.holders, candidate).effects,
                  expired
                )
              : []
          )
        )
      ].sort()
    }))
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
  autoRollByActorId: EncounterAutoRollByActorId
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
  const turnActorId = input.boundary.actorId
  if (!input.actors.some(({ id }) => id === turnActorId))
    throw new Error('Turn effect actor is unavailable.')
  const priorExecutions = input.priorPlan?.kind === 'STAGED' ? input.priorPlan.plan.executions : []
  const holders = await Promise.all(
    input.actors.map(async (actor) => {
      const currentEffects = await input.listEffects(turnEffectOwner(actor, input.state.id))
      if (
        priorExecutions.some(
          (entry) =>
            entry.targetActorId === actor.id &&
            !currentEffects.some((effect) => effect.id === entry.activeEffectId)
        )
      )
        throw new Error('Prior turn effect selection is stale.')
      return { actor, effects: overlayEffects(currentEffects, input.priorPlan) }
    })
  )
  const candidates = selectTurnEffectCandidates({
    state: input.state,
    stage: input.boundary.stage,
    turnActorId,
    holders
  })
  if (!candidates.length) return none()
  if (candidates.length + priorExecutions.length > 128)
    throw new Error('A turn may execute at most 128 active effects.')
  const selected = turnEffectSelectionChecksum(
    input.root.commandType,
    input.boundary,
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
  const held = new Map<
    string,
    { target: MovementTarget<TCharacterFacts>; effects: ActiveRuleEffectRecord[] }
  >()
  for (const { actor, effects } of holders) {
    const own = candidates.flatMap(({ holder, effect }) => (holder.id === actor.id ? [effect] : []))
    if (!own.length) continue
    await requireTurnMaintainedStates(input.state.id, actor, own, input.loadMaintainedState)
    const loaded = targets.get(actor.id) ?? (await input.loadTarget(actor.id))
    if (!loaded) throw new Error('Turn effect target facts are unavailable.')
    // Root-owned transient facts may include earlier phase mechanics and resource refreshes.
    const target = rebuildEncounterTurnTarget({
      source: loaded,
      actor,
      characterFacts: loaded.characterFacts,
      activeEffects: effects,
      state: input.state
    })
    targets.set(actor.id, target)
    held.set(actor.id, { target, effects })
  }
  const evaluated = await evaluateEncounterTurnEffects({
    ...input,
    targets,
    holders: held,
    candidates,
    selectionChecksum: selected,
    retainedPlan: input.retainedPhase?.kind === 'STAGED' ? input.retainedPhase.plan : undefined
  })
  if (evaluated.kind === 'PENDING') return evaluated
  const actors = new Map(input.actors.map((actor) => [actor.id, actor]))
  // One mechanics batch per holder, each spanning that holder's chained executions.
  for (const settlement of evaluated.settlements) {
    const { target, effects } = held.get(settlement.actorId)!
    const batch = turnEffectMechanicsBatch({
      ...input,
      target,
      rootCommandId: input.root.rootCommandId,
      occurredAt: target.characterFacts?.active.updatedAt ?? '1970-01-01T00:00:00.000Z',
      applications: settlement.applications,
      retainedConditionIds: settlement.retainedConditionIds
    })
    const mechanics = planEncounterMechanicsBatch({
      batch,
      actor: actors.get(settlement.actorId)!,
      userId: input.userId,
      characterFacts: target.characterFacts ?? undefined
    })
    const own = evaluated.plan.executions.filter(
      ({ targetActorId }) => targetActorId === settlement.actorId
    )
    if (
      !same(mechanics.targetTransition.before, own[0]!.targetTransition.before) ||
      !same(mechanics.targetTransition.after, own.at(-1)!.targetTransition.after)
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
      settlement.actorId,
      rebuildEncounterTurnTarget({
        source: target,
        actor: projected.actor,
        characterFacts: projected.characterFacts,
        activeEffects: overlayEffects(effects, { kind: 'STAGED', plan: evaluated.plan }),
        state: input.state
      })
    )
    actors.set(settlement.actorId, mechanics.updatedActor)
  }
  return {
    kind: 'COMPLETE',
    actors: input.actors.map(({ id }) => actors.get(id)!),
    movementTargets: targets,
    plan: evaluated.plan,
    phase: { kind: 'STAGED', plan: evaluated.plan }
  }
}
