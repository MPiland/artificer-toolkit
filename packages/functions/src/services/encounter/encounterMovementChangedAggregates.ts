import type { EncounterRecord } from '@artificer-toolkit/db'
import type { LiveSessionAggregateVersionDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'

import { EncounterConflictError } from './encounterErrors.js'

type MovementTerminalResult = Extract<
  StoredRuleExecutionResultDto,
  | { status: 'MOVEMENT_COMPLETE' }
  | { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>

type ReactionExecution = MovementTerminalResult['reactionExecutions'][number]
type SpatialCharacterTransition = Extract<
  StoredRuleExecutionResultDto,
  { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>['characterTransitions'][number]

export type MovementCommandTransition =
  | {
      kind: 'SPATIAL_PREFIX'
      result: Extract<
        StoredRuleExecutionResultDto,
        { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
      >
    }
  | { kind: 'REACTION'; execution: ReactionExecution }

export type MovementChangedAggregate = Omit<
  LiveSessionAggregateVersionDto,
  'aggregateKind' | 'beforeVersion'
> & {
  aggregateKind: 'CHARACTER' | 'ENCOUNTER' | 'SCENE'
  beforeVersion: number
}

function characterVersions(
  reactionExecutions: readonly ReactionExecution[],
  spatialTransitions: readonly {
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }[] = [],
  spatialFirst = false
): MovementChangedAggregate[] {
  const versions = new Map<string, { beforeVersion: number; version: number }>()
  const append = (transition: {
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }) => {
    const current = versions.get(transition.characterId)
    if (current && current.version !== transition.beforeStreamVersion)
      throw new EncounterConflictError('Spatial Character transitions are not contiguous.')
    versions.set(transition.characterId, {
      beforeVersion: current?.beforeVersion ?? transition.beforeStreamVersion,
      version: transition.afterStreamVersion
    })
  }
  const appendReactions = () => {
    for (const execution of reactionExecutions)
      for (const transition of execution.characterTransitions) append(transition)
  }
  if (spatialFirst) {
    for (const transition of spatialTransitions) append(transition)
    appendReactions()
  } else {
    appendReactions()
    for (const transition of spatialTransitions) append(transition)
  }
  return [...versions]
    .map(([aggregateId, transition]) => ({
      aggregateKind: 'CHARACTER' as const,
      aggregateId,
      ...transition
    }))
    .sort((left, right) => left.aggregateId.localeCompare(right.aggregateId))
}

export function movementReactionCharacterAggregateVersions(
  reactionExecutions: readonly ReactionExecution[]
): MovementChangedAggregate[] {
  return characterVersions(reactionExecutions)
}

/** Exact Character stream transitions already committed before a movement pause. */
export function movementPendingCharacterAggregateVersions(input: {
  reactionExecutions: readonly ReactionExecution[]
  appliedSpatialPrefix: StoredRuleExecutionResultDto | null
}): MovementChangedAggregate[] {
  const spatialTransitions =
    input.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
    input.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? (input.appliedSpatialPrefix.characterTransitions as readonly SpatialCharacterTransition[])
      : []
  return characterVersions(input.reactionExecutions ?? [], spatialTransitions, true)
}

/**
 * Command-local transitions only.  A pending movement continuation retains
 * cumulative evidence for replay, but that history must never advance an
 * Encounter or republish Character versions on a later command.
 */
export function movementCommandCharacterAggregateVersions(
  transitions: readonly MovementCommandTransition[]
): MovementChangedAggregate[] {
  const versions = new Map<string, { beforeVersion: number; version: number }>()
  const append = (transition: {
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }) => {
    const current = versions.get(transition.characterId)
    if (current && current.version !== transition.beforeStreamVersion)
      throw new EncounterConflictError('Movement Character transitions are not contiguous.')
    versions.set(transition.characterId, {
      beforeVersion: current?.beforeVersion ?? transition.beforeStreamVersion,
      version: transition.afterStreamVersion
    })
  }
  for (const transition of transitions) {
    if (transition.kind === 'REACTION') {
      for (const characterTransition of transition.execution.characterTransitions)
        append(characterTransition)
    } else {
      for (const characterTransition of transition.result
        .characterTransitions as readonly SpatialCharacterTransition[])
        append(characterTransition)
    }
  }
  return [...versions]
    .map(([aggregateId, transition]) => ({
      aggregateKind: 'CHARACTER' as const,
      aggregateId,
      ...transition
    }))
    .sort((left, right) => left.aggregateId.localeCompare(right.aggregateId))
}

export function terminalMovementChangedAggregates(input: {
  encounter: Pick<EncounterRecord, 'id'>
  result: MovementTerminalResult
  expectedSceneVersion: number
  expectedEncounterVersion: number
  sourceCommandId: string
}): MovementChangedAggregate[] {
  if (
    input.result.encounterVersion !== input.expectedEncounterVersion + 1 ||
    (input.result.sceneVersion !== input.expectedSceneVersion &&
      input.result.sceneVersion !== input.expectedSceneVersion + 1)
  )
    throw new EncounterConflictError('Spatial aggregate transition is unavailable.')
  return [
    ...characterVersions(
      input.result.reactionExecutions.filter(
        (execution) => execution.sourceCommandId === input.sourceCommandId
      ),
      input.result.status === 'BATCH_COMPLETE' ? input.result.characterTransitions : []
    ),
    {
      aggregateId: input.encounter.id,
      aggregateKind: 'ENCOUNTER' as const,
      beforeVersion: input.expectedEncounterVersion,
      version: input.result.encounterVersion
    },
    ...(input.result.sceneVersion === input.expectedSceneVersion
      ? []
      : [
          {
            aggregateId: input.result.sceneId,
            aggregateKind: 'SCENE' as const,
            beforeVersion: input.expectedSceneVersion,
            version: input.result.sceneVersion
          }
        ])
  ].sort((left, right) =>
    `${left.aggregateKind}:${left.aggregateId}`.localeCompare(
      `${right.aggregateKind}:${right.aggregateId}`
    )
  )
}
