import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  storedRuleExecutionResultDtoSchema,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { EncounterMechanicsBatchPlan } from './encounterMechanicsBatchPlan.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { spatialEffectTransition } from './encounterSpatialMovementEffects.js'
import type {
  FrozenMovementReactionRemainder,
  SpatialMovementRuleRoot
} from './encounterSpatialMovementRuleService.js'

type SpatialBatch = Extract<
  StoredRuleExecutionResultDto,
  { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>
type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>

export function retainedMovementSpatialExecutions(outcome: Outcome) {
  if (outcome.kind === 'TERMINAL')
    return outcome.result.status === 'BATCH_COMPLETE' ? outcome.result.executions : []
  const context = outcome.pendingSnapshot.applicationContext

  if (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT') return context.completedExecutions

  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION') return context.completedSpatialExecutions

  if (context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
    return context.movement.completedSpatialExecutions

  if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' && context.movementContinuation)
    return context.movementContinuation.completedSpatialExecutions

  throw new Error('Retained Scene movement evidence is unavailable.')
}

export function retainedMovementReactionExecutions(outcome: Outcome) {
  if (outcome.kind === 'TERMINAL') return outcome.result.reactionExecutions

  const context = outcome.pendingSnapshot.applicationContext

  if (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT') return []

  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION') return context.completedReactionExecutions

  if (context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
    return context.movement.completedReactionExecutions

  if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' && context.movementContinuation)
    return context.movementContinuation.completedReactionExecutions

  throw new Error('Retained Scene movement reaction evidence is unavailable.')
}

/** Projects the exact spatial receipt from already planned, settled state. */
export function projectSpatialMovementResult(input: {
  encounterId: string
  encounterVersion: number
  sceneId: string
  sceneVersion: number
  occurrenceId: string
  occurrenceVersion: number
  root: Pick<SpatialMovementRuleRoot, 'tokenId' | 'movementKind' | 'originalPath'>
  currentPosition: ScenePoint
  terminalPosition: ScenePoint | null
  executions: Readonly<FrozenMovementReactionRemainder['completedSpatialExecutions']>
  effects: ReadonlyMap<string, EncounterSpatialRuleEffectRecord>
  targets: ReadonlyMap<string, Pick<MovementTarget, 'actor' | 'characterFacts'>>
  settlements: readonly {
    targetActorId: string
    targetTransition: EncounterMechanicsBatchPlan['targetTransition']
    characterStreamVersion: number | null
  }[]
  appliedSpatialPrefix: SpatialBatch | null
  completedReactionExecutions: Readonly<
    FrozenMovementReactionRemainder['completedReactionExecutions']
  >
  remainingEffectIds?: readonly string[]
}): SpatialBatch {
  const historical = input.appliedSpatialPrefix
  const characterTransitions: SpatialBatch['characterTransitions'] = []
  const encounterActorTransitions: SpatialBatch['encounterActorTransitions'] = []
  for (const settlement of input.settlements) {
    const target = input.targets.get(settlement.targetActorId)
    const first = input.executions.find(
      (execution) => execution.candidate.candidate.targetActorId === settlement.targetActorId
    )
    const last = [...input.executions]
      .reverse()
      .find((execution) => execution.candidate.candidate.targetActorId === settlement.targetActorId)
    if (!target || !first || !last) throw new Error('Spatial execution target is unavailable.')
    if (
      JSON.stringify(settlement.targetTransition.before) !==
      JSON.stringify(first.targetTransition.before)
    )
      throw new Error('Spatial target publication does not match evaluated outcomes.')
    if (
      JSON.stringify(settlement.targetTransition.after) !==
      JSON.stringify(last.targetTransition.after)
    )
      throw new Error('Spatial target publication does not match evaluated outcomes.')
    if (target.actor.kind === 'CHARACTER') {
      if (settlement.characterStreamVersion === null)
        throw new Error('Spatial Character state must advance once.')
      if (!target.characterFacts)
        throw new Error('Spatial Character settlement span is unavailable.')
      characterTransitions.push({
        characterId: target.actor.sourceId,
        targetActorId: settlement.targetActorId,
        beforeStreamVersion: target.characterFacts.active.streamVersion,
        afterStreamVersion: settlement.characterStreamVersion,
        before: first.targetTransition.before,
        after: settlement.targetTransition.after
      })
    } else
      encounterActorTransitions.push({
        targetActorId: settlement.targetActorId,
        before: first.targetTransition.before,
        after: settlement.targetTransition.after
      })
  }

  const spatialEffectTransitions: SpatialBatch['spatialEffectTransitions'] = []
  for (const effectId of [
    ...new Set(input.executions.map((execution) => execution.candidate.candidate.effectId))
  ].sort()) {
    const effect = input.effects.get(effectId)
    if (!effect) throw new Error('Spatial execution effect is unavailable.')
    const transition = spatialEffectTransition(effect)
    const prior = historical?.spatialEffectTransitions.find((entry) => entry.effectId === effectId)
    if (prior && checksumRuleDocument(prior.transition) !== checksumRuleDocument(transition))
      throw new Error('Spatial continuation lifecycle evidence is inconsistent.')
    spatialEffectTransitions.push({ effectId, transition })
  }

  const position = input.terminalPosition ?? input.root.originalPath.at(-1)!
  const moved =
    Math.abs(position.x - input.currentPosition.x) > 1e-8 ||
    Math.abs(position.y - input.currentPosition.y) > 1e-8
  const effectTransitions = new Map(
    [...(historical?.spatialEffectTransitions ?? []), ...spatialEffectTransitions].map((entry) => [
      entry.effectId,
      entry
    ])
  )
  const consumedSpatialEffects = [...new Set(input.remainingEffectIds ?? [])]
    .sort()
    .flatMap((effectId) => {
      if (effectTransitions.get(effectId)?.transition.kind !== 'DELETE') return []
      const effect =
        input.effects.get(effectId) ??
        historical?.consumedSpatialEffects?.find((entry) => entry.id === effectId)
      if (!effect) throw new Error('A consumed spatial continuation is unavailable.')
      return [effect]
    })
  const characterById = new Map(
    (historical?.characterTransitions ?? []).map((entry) => [entry.characterId, entry])
  )
  for (const entry of characterTransitions) {
    const prior = characterById.get(entry.characterId)
    characterById.set(entry.characterId, {
      ...entry,
      before: prior?.before ?? entry.before,
      beforeStreamVersion: prior?.beforeStreamVersion ?? entry.beforeStreamVersion
    })
  }
  const actorById = new Map(
    (historical?.encounterActorTransitions ?? []).map((entry) => [entry.targetActorId, entry])
  )
  for (const entry of encounterActorTransitions)
    actorById.set(entry.targetActorId, {
      ...entry,
      before: actorById.get(entry.targetActorId)?.before ?? entry.before
    })

  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'BATCH_COMPLETE',
    batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    encounterId: input.encounterId,
    encounterVersion: input.encounterVersion,
    sceneId: input.sceneId,
    sceneVersion: input.sceneVersion + (moved ? 1 : 0),
    tokenId: input.root.tokenId,
    movementKind: input.root.movementKind,
    reactionExecutions: input.completedReactionExecutions,
    terminalPosition: position,
    executions: [...(historical?.executions ?? []), ...input.executions],
    spatialEffectTransitions: [...effectTransitions.values()].sort((left, right) =>
      left.effectId.localeCompare(right.effectId)
    ),
    ...(consumedSpatialEffects.length ? { consumedSpatialEffects } : {}),
    characterTransitions: [...characterById.values()].sort((left, right) =>
      left.characterId.localeCompare(right.characterId)
    ),
    encounterActorTransitions: [...actorById.values()].sort((left, right) =>
      left.targetActorId.localeCompare(right.targetActorId)
    )
  })
  if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
    throw new Error('Spatial publication result is invalid.')
  return result
}
