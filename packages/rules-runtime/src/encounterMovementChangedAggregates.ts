import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  ServerRuleExecutionApplicationOutputsDto,
  StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import { EncounterConflictError } from './encounterErrors.js'
import { meleeRetaliationCharacterTransition } from './encounterMeleeRetaliation.js'

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

type ConcentrationChild = {
  result: {
    applicationOutputs: {
      cleanup: { characterOwnerTransitions: readonly CharacterVersionTransition[] } | null
    }
  }
}

/** A contact's Concentration children advance Character versions in order: its end, then its checks. */
function concentrationChildren(contact: {
  concentrationEnd?: ConcentrationChild
  concentrationChecks?: readonly ConcentrationChild[]
}) {
  return [
    ...(contact.concentrationEnd ? [contact.concentrationEnd] : []),
    ...(contact.concentrationChecks ?? [])
  ]
}

type MovementReactionCharacterExecution = {
  characterTransitions: readonly CharacterVersionTransition[]
  concentrationEnd?: ConcentrationChild
  concentrationChecks?: readonly ConcentrationChild[]
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
  concentrationEnd?: ConcentrationChild
  concentrationChecks?: readonly ConcentrationChild[]
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
  | {
      kind: 'REACTION'
      execution: {
        characterTransitions: readonly CharacterVersionTransition[]
        application: ServerRuleExecutionApplicationOutputsDto
      }
    }
  | { kind: 'AREA_DEPARTURE'; characterTransitions: readonly CharacterVersionTransition[] }
  | { kind: 'MOVE_END'; characterTransitions: readonly CharacterVersionTransition[] }
  | { kind: 'PASSAGE'; characterTransitions: readonly CharacterVersionTransition[] }
  | { kind: 'CONCENTRATION' | 'CONCENTRATION_END'; execution: ConcentrationChild }

type MovementChangedAggregate = {
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
  }[] = []
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
  for (const execution of reactionExecutions) {
    for (const transition of execution.characterTransitions) append(transition)
    for (const child of concentrationChildren(execution))
      for (const transition of child.result.applicationOutputs.cleanup?.characterOwnerTransitions ??
        [])
        append(transition)
  }
  for (const transition of spatialTransitions) append(transition)
  return [...versions]
    .map(([aggregateId, transition]) => ({
      aggregateKind: 'CHARACTER' as const,
      aggregateId,
      ...transition
    }))
    .sort((left, right) => left.aggregateId.localeCompare(right.aggregateId))
}

/**
 * Exact Character stream transitions an initial movement's spatial prefix committed before it
 * paused. No reaction runs before its controller's choice, so none precede the first pause.
 */
export function movementPendingCharacterAggregateVersions(
  appliedSpatialPrefix: MovementPendingSpatialPrefix | null
): MovementChangedAggregate[] {
  const executions = appliedSpatialPrefix?.executions
  if (executions === undefined)
    return characterVersions([], appliedSpatialPrefix?.characterTransitions ?? [])

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
  const ordered = [...executions].sort(
    (left, right) =>
      left.candidate.candidate.pathDistance - right.candidate.candidate.pathDistance ||
      left.ordinal - right.ordinal
  )
  for (const execution of ordered) {
    const target = execution.candidate.target
    if (target.kind !== 'CHARACTER') continue
    const group = spatialGroups.get(target.characterId)
    if (
      group &&
      (group.version !== target.streamVersion ||
        JSON.stringify(group.after) !== JSON.stringify(execution.targetTransition.before))
    )
      finishSpatialGroups()
    const current = spatialGroups.get(target.characterId)
    if (current) current.after = execution.targetTransition.after
    else
      spatialGroups.set(target.characterId, {
        version: target.streamVersion,
        before: execution.targetTransition.before,
        after: execution.targetTransition.after
      })
    if (execution.concentrationEnd !== undefined || execution.concentrationChecks !== undefined) {
      finishSpatialGroups()
      for (const child of concentrationChildren(execution))
        for (const transition of child.result.applicationOutputs.cleanup
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
      const { application } = transition.execution
      // The zones the reaction's melee hit set off settle on the reactor after its own batch.
      const retaliation =
        application.kind === 'CHARACTER_MECHANICS_BATCH' ||
        application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
          ? meleeRetaliationCharacterTransition(application.meleeRetaliation)
          : null
      if (retaliation) append(retaliation)
    } else if (transition.kind === 'SPATIAL_PREFIX') {
      for (const characterTransition of transition.result.characterTransitions)
        append(characterTransition)
    } else if (
      transition.kind === 'AREA_DEPARTURE' ||
      transition.kind === 'MOVE_END' ||
      transition.kind === 'PASSAGE'
    ) {
      for (const characterTransition of transition.characterTransitions) append(characterTransition)
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
