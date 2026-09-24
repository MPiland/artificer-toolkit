import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { projectSpatialMovementCandidates } from './encounterSpatialMovementCurrentness.js'
import { spatialMovementEffectBeforeTransition } from './encounterSpatialMovementEffects.js'
import { planNativeSpatialMovementPrefix } from './encounterSpatialMovementPlan.js'
import { projectSpatialMovementResult } from './encounterSpatialMovementResult.js'
import {
  checksumSpatialCurrentness,
  evaluateEncounterSpatialMovementRuleBatch,
  type SpatialMovementTarget
} from './encounterSpatialMovementRuleService.js'

type EvaluationInput = Parameters<typeof evaluateEncounterSpatialMovementRuleBatch>[0]
type SpatialExecution = Extract<
  StoredRuleExecutionResultDto,
  { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>['executions'][number]
type TerminalInput = Parameters<NonNullable<EvaluationInput['applyTerminal']>>[0]

export type SpatialMovementPreparationInput = Omit<
  EvaluationInput,
  | 'encounter'
  | 'actorUserId'
  | 'spatialScope'
  | 'loadTargets'
  | 'applyTerminal'
  | 'runtime'
  | 'rollD20'
> & {
  occurredAt: string
  retainedExecutions?: readonly SpatialExecution[]
}

export type PreparedSpatialMovementPlan<TCharacterFacts extends ProjectableCharacterFacts> = Pick<
  TerminalInput,
  'effects' | 'executions' | 'root' | 'appliedSpatialPrefix' | 'completedReactionExecutions'
> & {
  remainingEffectIds?: readonly string[]
  terminalPosition: { x: number; y: number } | null
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  mechanicsPlan: ReturnType<typeof planNativeSpatialMovementPrefix<TCharacterFacts>>
  input: Pick<
    SpatialMovementPreparationInput,
    'occurrenceId' | 'occurrenceVersion' | 'sceneId' | 'sceneVersion' | 'currentPosition'
  >
  state: EncounterRunState
  targetsUserId: string
}

function retainedSpatialReplayFaces(input: SpatialMovementPreparationInput): number[] {
  if (!input.retainedExecutions) return []
  const pendingContext = input.pendingSnapshot?.applicationContext
  const completedOrdinals = new Set(
    pendingContext?.kind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? pendingContext.completedExecutions.map((execution) => execution.ordinal)
      : pendingContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION'
        ? pendingContext.completedSpatialExecutions.map((execution) => execution.ordinal)
        : (input.frozenReactionRemainder?.completedSpatialExecutions.map(
            (execution) => execution.ordinal
          ) ?? [])
  )
  const pendingOrdinal =
    input.resolution?.kind === 'ENTER_DICE'
      ? pendingContext?.kind === 'ENCOUNTER_SPATIAL_MOVEMENT'
        ? pendingContext.currentCandidate.ordinal
        : pendingContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
            pendingContext.phase.kind === 'SPATIAL_EVIDENCE'
          ? pendingContext.phase.currentCandidate.ordinal
          : null
      : null
  const boundary = input.interruptAfterPathDistance
  return input.retainedExecutions.flatMap((execution) => {
    if (
      completedOrdinals.has(execution.ordinal) ||
      execution.ordinal === pendingOrdinal ||
      (boundary !== undefined && execution.candidate.candidate.pathDistance > boundary + 1e-8)
    )
      return []
    return execution.d20?.rawFaces ?? []
  })
}

function toSpatialMovementTarget<TCharacterFacts extends ProjectableCharacterFacts>(
  target: MovementTarget<TCharacterFacts>
): SpatialMovementTarget {
  return {
    actor: target.actor,
    character:
      target.actor.kind === 'CHARACTER'
        ? {
            id: target.actor.sourceId!,
            streamVersion: target.actor.sourceRevision!,
            maximumHitPoints: target.effectiveMaximumHitPoints,
            ...target.characterCurrentness!
          }
        : null,
    state: { ...target.state, conditions: [...target.state.conditions] },
    targetDerivedFacts: target.targetDerivedFacts,
    defenses: target.defenses,
    conditionImmunityIds: target.conditionImmunityIds,
    scalarValues: target.effectiveScalarValues
  }
}

export function projectPreparedSpatialMovementReceipt<
  TCharacterFacts extends ProjectableCharacterFacts
>(plan: PreparedSpatialMovementPlan<TCharacterFacts>) {
  return projectSpatialMovementResult({
    occurrenceId: plan.input.occurrenceId,
    occurrenceVersion: plan.input.occurrenceVersion ?? 0,
    encounterId: plan.state.id,
    encounterVersion: plan.state.version + 1,
    sceneId: plan.input.sceneId,
    sceneVersion: plan.input.sceneVersion,
    root: plan.root,
    currentPosition: plan.input.currentPosition,
    terminalPosition: plan.terminalPosition,
    executions: plan.executions,
    effects: plan.effects,
    targets: plan.targets,
    settlements: plan.mechanicsPlan.settlements.map(({ batch, plan: settlement }) => ({
      targetActorId: batch.targetActorId,
      targetTransition: settlement.targetTransition,
      characterStreamVersion: settlement.characterStreamVersion
    })),
    appliedSpatialPrefix:
      plan.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
      plan.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
        ? plan.appliedSpatialPrefix
        : null,
    completedReactionExecutions: plan.completedReactionExecutions,
    remainingEffectIds: plan.remainingEffectIds
  })
}

/** Prepares spatial rules and portable settlement plans from trusted current reads. */
export async function prepareEncounterSpatialMovement<
  TCharacterFacts extends ProjectableCharacterFacts
>(args: {
  input: SpatialMovementPreparationInput
  state: EncounterRunState
  userId: string
  runtime?: RulesRuntimeService
  rollD20: () => number
  spatialScope: {
    list(): Promise<EncounterSpatialRuleEffectRecord[]>
    get(id: string): Promise<EncounterSpatialRuleEffectRecord | null>
  }
  loadTargets(
    actorIds: readonly string[]
  ): Promise<ReadonlyMap<string, MovementTarget<TCharacterFacts>>>
  determineConcentrationActorIds?: (
    actorIds: readonly string[],
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  ) => Promise<ReadonlySet<string>>
  settleTerminal?: (
    plan: PreparedSpatialMovementPlan<TCharacterFacts>
  ) => Promise<ReturnType<typeof projectPreparedSpatialMovementReceipt<TCharacterFacts>>>
}) {
  const { input, state, userId } = args
  const replayFaces = retainedSpatialReplayFaces(input)
  let targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>> = new Map()
  const lockedEffects = new Map<string, EncounterSpatialRuleEffectRecord>()
  const concentrationActorIds = new Set<string>()
  const pendingContext = input.pendingSnapshot?.applicationContext
  const remainder =
    input.frozenReactionRemainder ??
    (pendingContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION' ? pendingContext : null)
  const history = remainder?.appliedSpatialPrefix
  if (
    history &&
    (history.status !== 'BATCH_COMPLETE' || history.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
    throw new Error('Spatial continuation history is unavailable.')
  const continuedEffectIds = new Set([
    ...(remainder?.completedSpatialExecutions
      .slice(history?.executions.length ?? 0)
      .map((execution) => execution.candidate.effect.effectId) ?? []),
    ...(remainder?.remainingSpatialCandidates.map((candidate) => candidate.effect.effectId) ?? []),
    ...(pendingContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    pendingContext.phase.kind === 'SPATIAL_EVIDENCE'
      ? [pendingContext.phase.currentCandidate.effect.effectId]
      : [])
  ])
  const restoreEffect = (id: string, current: EncounterSpatialRuleEffectRecord | null) => {
    const prior = continuedEffectIds.has(id)
      ? history?.spatialEffectTransitions.find((entry) => entry.effectId === id)
      : null
    return prior
      ? spatialMovementEffectBeforeTransition({
          current,
          consumed: history?.consumedSpatialEffects?.find((entry) => entry.id === id),
          effectId: id,
          transition: prior.transition,
          encounterId: state.id,
          sceneId: input.sceneId,
          allowUnapplied: history!.encounterVersion > state.version
        })
      : current
  }
  const evaluated = await evaluateEncounterSpatialMovementRuleBatch({
    ...input,
    interruptAfterDamageToActorIds: concentrationActorIds,
    actorUserId: userId,
    encounter: { ...state, actors: state.actorIds.map((id) => ({ id })) },
    runtime: args.runtime,
    rollD20: () => {
      if (input.retainedExecutions) {
        const face = replayFaces.shift()
        if (face === undefined)
          throw new Error('Retained spatial replay evidence is missing a d20 face.')
        return face
      }
      return args.rollD20()
    },
    spatialScope: {
      snapshot: async () => {
        const effects = new Map(
          (await args.spatialScope.list()).map((effect) => [effect.id, effect])
        )
        for (const id of continuedEffectIds) {
          const effect = restoreEffect(id, effects.get(id) ?? null)
          if (effect) effects.set(id, effect)
        }
        return [...effects.values()]
      },
      lockById: async ({ id }) => {
        const effect = restoreEffect(id, await args.spatialScope.get(id))
        if (effect) lockedEffects.set(id, effect)
        return effect
      }
    },
    loadTargets: async (actorIds) => {
      targets = await args.loadTargets(actorIds)
      if (args.determineConcentrationActorIds)
        for (const id of await args.determineConcentrationActorIds(actorIds, targets))
          concentrationActorIds.add(id)
      return new Map([...targets].map(([id, target]) => [id, toSpatialMovementTarget(target)]))
    },
    applyTerminal: async ({
      root,
      effects,
      executions,
      terminalPosition,
      appliedSpatialPrefix,
      completedReactionExecutions
    }) => {
      const plan: PreparedSpatialMovementPlan<TCharacterFacts> = {
        targets,
        effects,
        executions,
        root,
        terminalPosition: terminalPosition ?? null,
        input: {
          occurrenceId: input.occurrenceId,
          occurrenceVersion: input.occurrenceVersion,
          sceneId: input.sceneId,
          sceneVersion: input.sceneVersion,
          currentPosition: input.currentPosition
        },
        state,
        targetsUserId: userId,
        appliedSpatialPrefix,
        completedReactionExecutions,
        mechanicsPlan: planNativeSpatialMovementPrefix({
          targets,
          executions,
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurrenceId: input.occurrenceId,
          sourceCommandId: input.executionCommandId,
          occurredAt: input.occurredAt,
          userId,
          projectTargets: false
        })
      }
      return args.settleTerminal
        ? args.settleTerminal(plan)
        : projectPreparedSpatialMovementReceipt(plan)
    }
  })
  if (
    replayFaces.length &&
    !(evaluated.kind === 'REACTION_BOUNDARY' && evaluated.damageExecutionOrdinal !== undefined)
  )
    throw new Error('Retained spatial replay evidence contains unused d20 faces.')
  if (evaluated.kind !== 'REACTION_BOUNDARY' || !evaluated.completedExecutions.length)
    return evaluated
  const previouslyApplied =
    evaluated.appliedPrefix?.status === 'BATCH_COMPLETE' &&
    evaluated.appliedPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? evaluated.appliedPrefix.executions.length
      : 0
  const executions = evaluated.completedExecutions.slice(previouslyApplied)
  if (!executions.length) return evaluated
  const mechanicsPlan = planNativeSpatialMovementPrefix({
    targets,
    executions,
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.executionCommandId,
    occurredAt: input.occurredAt,
    userId
  })
  const prefixSettlementPlan: PreparedSpatialMovementPlan<TCharacterFacts> = {
    remainingEffectIds: evaluated.remainingCandidates.map((candidate) => candidate.effect.effectId),
    mechanicsPlan,
    targets,
    effects: lockedEffects,
    executions,
    root: input.root,
    terminalPosition: evaluated.boundaryPosition,
    input: {
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      sceneId: input.sceneId,
      sceneVersion: input.sceneVersion,
      currentPosition: input.currentPosition
    },
    state,
    targetsUserId: userId,
    appliedSpatialPrefix: evaluated.appliedPrefix,
    completedReactionExecutions: evaluated.completedReactionExecutions
  }
  const prefixSettlement = projectPreparedSpatialMovementReceipt(prefixSettlementPlan)
  const remainingCandidates = projectSpatialMovementCandidates({
    candidates: evaluated.remainingCandidates,
    beforeTargets: targets,
    afterTargets: mechanicsPlan.projectedTargets
  })
  const preparedBoundary = {
    ...evaluated,
    appliedPrefix: prefixSettlement,
    remainingCandidates,
    currentnessChecksum: checksumSpatialCurrentness({
      encounter: state,
      candidates: remainingCandidates
    })
  }
  return { ...evaluated, prefixSettlement, prefixSettlementPlan, preparedBoundary }
}
