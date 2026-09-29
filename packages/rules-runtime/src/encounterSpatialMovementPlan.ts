import { deriveEncounterCharacterMechanicsEventCommandId } from './encounterCharacterMechanicsBatch.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { FrozenMovementReactionRemainder } from './encounterSpatialMovementRuleService.js'
import {
  planEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput,
  type EncounterMechanicsBatchPlan
} from './encounterMechanicsBatchPlan.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'

type SpatialExecution = FrozenMovementReactionRemainder['completedSpatialExecutions'][number]

type Settlement = {
  batch: EncounterMechanicsBatchInput
  plan: EncounterMechanicsBatchPlan
}

/** Plans a verified completed spatial prefix without publishing target or effect state. */
export function planNativeSpatialMovementPrefix<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  executions: readonly SpatialExecution[]
  encounterId: string
  expectedEncounterVersion: number
  campaignId: string
  gameSystemId: string
  occurrenceId: string
  sourceCommandId: string
  occurredAt: string
  userId: string
  projectTargets?: boolean
}): {
  projectedTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  settlements: Settlement[]
} {
  const executionsByTarget = new Map<string, SpatialExecution[]>()
  for (const execution of input.executions) {
    const targetActorId = execution.candidate.candidate.targetActorId
    const target = input.targets.get(targetActorId)
    if (!target) throw new Error('Spatial execution target is unavailable.')
    if (
      target.actor.id !== targetActorId ||
      target.actor.encounterId !== input.encounterId ||
      target.actor.systemId !== input.gameSystemId
    )
      throw new Error('Spatial execution target is stale.')
    const grouped = executionsByTarget.get(targetActorId) ?? []
    const previous = grouped.at(-1)
    if (previous && !sameState(previous.targetTransition.after, execution.targetTransition.before))
      throw new Error('Spatial target transitions do not chain.')
    grouped.push(execution)
    executionsByTarget.set(targetActorId, grouped)
  }

  const changed = [...executionsByTarget].flatMap(([targetActorId, executions]) => {
    const target = input.targets.get(targetActorId)
    const first = executions[0]
    const last = executions.at(-1)
    if (!target || !first || !last) throw new Error('Spatial execution target is unavailable.')
    assertInitialTransition(targetActorId, target, first)
    return sameState(first.targetTransition.before, last.targetTransition.after)
      ? []
      : [[targetActorId, target] as const]
  })
  const characterTargets = changed
    .filter(([, target]) => target.actor.kind === 'CHARACTER')
    .sort(([, left], [, right]) => left.actor.sourceId!.localeCompare(right.actor.sourceId!))
  const actorTargets = changed
    .filter(([, target]) => target.actor.kind !== 'CHARACTER')
    .sort(([left], [right]) => left.localeCompare(right))
  const projectedTargets = new Map(input.targets)
  const settlements: Settlement[] = []
  for (const [ordinal, [targetActorId, target]] of [
    ...characterTargets,
    ...actorTargets
  ].entries()) {
    const executions = executionsByTarget.get(targetActorId)
    if (!executions) throw new Error('Spatial execution target is unavailable.')
    const applications = executions.flatMap((execution) =>
      execution.applications.map((application) => ({ ...application, targetActorId }))
    )
    const batch: EncounterMechanicsBatchInput = {
      encounterId: input.encounterId,
      targetActorId,
      expectedEncounterVersion: input.expectedEncounterVersion,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.sourceCommandId,
      commandId:
        target.actor.kind === 'CHARACTER'
          ? deriveEncounterCharacterMechanicsEventCommandId({
              occurrenceId: input.occurrenceId,
              sourceCommandId: input.sourceCommandId,
              phase: 'SPATIAL_EFFECT',
              // Preserve first-segment IDs and reserve disjoint ordinals for later segments.
              ordinal: (input.executions[0]?.ordinal ?? 0) + ordinal,
              targetCharacterId: target.actor.sourceId
            })
          : input.sourceCommandId,
      occurredAt: input.occurredAt,
      applications,
      expectedCharacterStreamVersion: target.characterFacts?.active.play.streamVersion ?? null,
      effectiveMaximumHitPoints: target.effectiveMaximumHitPoints,
      effectiveScalarValues: target.effectiveScalarValues,
      forceVersionAdvance: target.actor.kind === 'CHARACTER'
    }
    const plan = planEncounterMechanicsBatch({
      batch,
      actor: target.actor,
      userId: input.userId,
      ...(target.characterFacts ? { characterFacts: target.characterFacts } : {})
    })
    const last = executions.at(-1)
    if (!last || !sameState(last.targetTransition.after, plan.targetTransition.after))
      throw new Error('Spatial target plan does not match evaluated outcomes.')
    if (input.projectTargets !== false)
      projectedTargets.set(
        targetActorId,
        projectEncounterActionTarget({
          target,
          actor: plan.updatedActor,
          plan,
          campaignId: input.campaignId,
          gameSystemId: input.gameSystemId,
          occurredAt: input.occurredAt
        })
      )
    settlements.push({ batch, plan })
  }
  return { projectedTargets, settlements }
}

function assertInitialTransition<TCharacterFacts extends ProjectableCharacterFacts>(
  targetActorId: string,
  target: MovementTarget<TCharacterFacts>,
  execution: SpatialExecution
) {
  const expectedChecksum = checksumRuleDocument({
    targetActorId,
    currentHitPoints: target.state.current,
    temporaryHitPoints: target.state.temporary,
    maximumHitPoints: target.effectiveMaximumHitPoints,
    conditionIds: target.state.conditions,
    scalarValues: target.effectiveScalarValues
  })
  if (
    execution.targetTransition.checksum !== expectedChecksum ||
    !sameState(execution.targetTransition.before, {
      currentHitPoints: target.state.current,
      temporaryHitPoints: target.state.temporary,
      maximumHitPoints: target.effectiveMaximumHitPoints,
      conditionIds: target.state.conditions,
      scalarValues: target.effectiveScalarValues
    })
  )
    throw new Error('Spatial target state is stale.')
}

function sameState(
  left: {
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    conditionIds: readonly string[]
    scalarValues: Readonly<Record<string, number>>
  },
  right: {
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    conditionIds: readonly string[]
    scalarValues: Readonly<Record<string, number>>
  }
) {
  return (
    checksumRuleDocument({
      currentHitPoints: left.currentHitPoints,
      temporaryHitPoints: left.temporaryHitPoints,
      maximumHitPoints: left.maximumHitPoints,
      conditionIds: left.conditionIds,
      scalarValues: left.scalarValues
    }) ===
    checksumRuleDocument({
      currentHitPoints: right.currentHitPoints,
      temporaryHitPoints: right.temporaryHitPoints,
      maximumHitPoints: right.maximumHitPoints,
      conditionIds: right.conditionIds,
      scalarValues: right.scalarValues
    })
  )
}
