import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'

import { EncounterConflictError } from './encounterErrors.js'

type MovementTerminalResult = Extract<
  StoredRuleExecutionResultDto,
  | { status: 'MOVEMENT_COMPLETE' }
  | { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
>

type CharacterVersionTransition = {
  characterId: string
  beforeStreamVersion: number
  afterStreamVersion: number
}

type MovementReactionCharacterExecution = {
  ordinal?: number
  option?: { candidate: { pathDistance: number } }
  characterTransitions: readonly CharacterVersionTransition[]
  concentrationChecks?: readonly {
    result: {
      applicationOutputs: {
        cleanup: { characterOwnerTransitions: readonly CharacterVersionTransition[] } | null
      }
    }
  }[]
}

type MovementPendingSpatialExecution = {
  ordinal: number
  candidate: {
    candidate: { pathDistance: number }
    target:
      | { kind: 'CHARACTER'; characterId: string; streamVersion: number }
      | { kind: 'ENCOUNTER_ACTOR' }
  }
  targetTransition: { before: unknown; after: unknown }
  concentrationChecks?: readonly {
    result: {
      applicationOutputs: {
        cleanup: { characterOwnerTransitions: readonly CharacterVersionTransition[] } | null
      }
    }
  }[]
}

type MovementPendingSpatialPrefix = {
  characterTransitions?: readonly CharacterVersionTransition[]
  executions?: readonly MovementPendingSpatialExecution[]
}

export type MovementCommandTransition =
  | {
      kind: 'SPATIAL_PREFIX'
      result: { characterTransitions: readonly CharacterVersionTransition[] }
    }
  | { kind: 'REACTION'; execution: { characterTransitions: readonly CharacterVersionTransition[] } }
  | {
      kind: 'CONCENTRATION'
      execution: {
        result: {
          applicationOutputs: {
            cleanup: { characterOwnerTransitions: readonly CharacterVersionTransition[] } | null
          }
        }
      }
    }

export type MovementChangedAggregate = {
  aggregateId: string
  aggregateKind: 'CHARACTER' | 'ENCOUNTER' | 'SCENE'
  beforeVersion: number
  version: number
}

function characterVersions(
  reactionExecutions: readonly MovementReactionCharacterExecution[],
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
    for (const execution of reactionExecutions) {
      for (const transition of execution.characterTransitions) append(transition)
      for (const check of execution.concentrationChecks ?? [])
        for (const transition of check.result.applicationOutputs.cleanup
          ?.characterOwnerTransitions ?? [])
          append(transition)
    }
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
  reactionExecutions: readonly MovementReactionCharacterExecution[]
): MovementChangedAggregate[] {
  return characterVersions(reactionExecutions)
}

/** Exact Character stream transitions already committed before a movement pause. */
export function movementPendingCharacterAggregateVersions(input: {
  reactionExecutions: readonly MovementReactionCharacterExecution[]
  appliedSpatialPrefix: MovementPendingSpatialPrefix | null
}): MovementChangedAggregate[] {
  const executions = input.appliedSpatialPrefix?.executions
  if (
    executions === undefined ||
    input.reactionExecutions.some(
      (execution) => execution.ordinal === undefined || execution.option === undefined
    )
  )
    return characterVersions(
      input.reactionExecutions,
      input.appliedSpatialPrefix?.characterTransitions ?? [],
      true
    )

  const versions = new Map<string, { beforeVersion: number; version: number }>()
  const append = (transition: CharacterVersionTransition) => {
    const current = versions.get(transition.characterId)
    if (current && current.version !== transition.beforeStreamVersion)
      throw new EncounterConflictError('Movement Character transitions are not contiguous.')
    versions.set(transition.characterId, {
      beforeVersion: current?.beforeVersion ?? transition.beforeStreamVersion,
      version: transition.afterStreamVersion
    })
  }
  const spatialGroups = new Map<string, { version: number; before: unknown; after: unknown }>()
  const finishSpatialGroups = () => {
    for (const [characterId, group] of spatialGroups)
      if (JSON.stringify(group.before) !== JSON.stringify(group.after))
        append({
          characterId,
          beforeStreamVersion: group.version,
          afterStreamVersion: group.version + 1
        })
    spatialGroups.clear()
  }
  const timeline: Array<
    | { kind: 'SPATIAL'; ordinal: number; distance: number; value: MovementPendingSpatialExecution }
    | {
        kind: 'REACTION'
        ordinal: number
        distance: number
        value: MovementReactionCharacterExecution
      }
  > = [
    ...executions.map((execution) => ({
      kind: 'SPATIAL' as const,
      ordinal: execution.ordinal,
      distance: execution.candidate.candidate.pathDistance,
      value: execution
    })),
    ...input.reactionExecutions.map((execution) => ({
      kind: 'REACTION' as const,
      ordinal: execution.ordinal!,
      distance: execution.option!.candidate.pathDistance,
      value: execution
    }))
  ].sort(
    (left, right) =>
      left.distance - right.distance ||
      (left.kind === right.kind ? left.ordinal - right.ordinal : left.kind === 'SPATIAL' ? -1 : 1)
  )
  for (const event of timeline) {
    if (event.kind === 'REACTION') {
      finishSpatialGroups()
      for (const transition of event.value.characterTransitions) append(transition)
      for (const check of event.value.concentrationChecks ?? [])
        for (const transition of check.result.applicationOutputs.cleanup
          ?.characterOwnerTransitions ?? [])
          append(transition)
      continue
    }
    const target = event.value.candidate.target
    if (target.kind !== 'CHARACTER') continue
    const group = spatialGroups.get(target.characterId)
    if (
      group &&
      (group.version !== target.streamVersion ||
        JSON.stringify(group.after) !== JSON.stringify(event.value.targetTransition.before))
    )
      finishSpatialGroups()
    const current = spatialGroups.get(target.characterId)
    if (current) current.after = event.value.targetTransition.after
    else
      spatialGroups.set(target.characterId, {
        version: target.streamVersion,
        before: event.value.targetTransition.before,
        after: event.value.targetTransition.after
      })
    if (event.value.concentrationChecks !== undefined) {
      finishSpatialGroups()
      for (const check of event.value.concentrationChecks)
        for (const transition of check.result.applicationOutputs.cleanup
          ?.characterOwnerTransitions ?? [])
          append(transition)
    }
  }
  finishSpatialGroups()
  return [...versions]
    .map(([aggregateId, transition]) => ({
      aggregateKind: 'CHARACTER' as const,
      aggregateId,
      ...transition
    }))
    .sort((left, right) => left.aggregateId.localeCompare(right.aggregateId))
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
    } else if (transition.kind === 'SPATIAL_PREFIX') {
      for (const characterTransition of transition.result.characterTransitions)
        append(characterTransition)
    } else {
      for (const characterTransition of transition.execution.result.applicationOutputs.cleanup
        ?.characterOwnerTransitions ?? [])
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
  encounter: Pick<EncounterRunState, 'id'>
  result: MovementTerminalResult
  expectedSceneVersion: number
  expectedEncounterVersion: number
  sourceCommandId: string
  commandCharacterTransitions?: readonly {
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }[]
}): MovementChangedAggregate[] {
  if (
    input.result.encounterVersion !== input.expectedEncounterVersion + 1 ||
    (input.result.sceneVersion !== input.expectedSceneVersion &&
      input.result.sceneVersion !== input.expectedSceneVersion + 1)
  )
    throw new EncounterConflictError('Spatial aggregate transition is unavailable.')
  return [
    ...characterVersions(
      input.commandCharacterTransitions
        ? []
        : input.result.reactionExecutions.filter(
            (execution) => execution.sourceCommandId === input.sourceCommandId
          ),
      input.commandCharacterTransitions ??
        (input.result.status === 'BATCH_COMPLETE' ? input.result.characterTransitions : [])
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
