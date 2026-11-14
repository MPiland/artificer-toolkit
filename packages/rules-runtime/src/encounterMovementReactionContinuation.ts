import {
  movementReactionChoiceSelectionDtoSchema,
  type MovementReactionChoiceGroupDto,
  type MovementReactionChoiceSelectionDto,
  type MovementReactionTimelineDto
} from '@artificer-toolkit/schema/shared/reaction'
import {
  movementReactionResolutionCommandDtoSchema,
  movementReactionActionEvidenceCommandDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionPendingApplicationContextDto,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { resumeReactionChoice, startReactionChoice } from './reactionChoiceDefinition.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { EncounterConflictError } from './encounterErrors.js'
import type {
  FrozenMovementReactionRemainder,
  SpatialMovementRuleEvaluation,
  SpatialMovementRuleRoot
} from './encounterSpatialMovementRuleService.js'

type MovementReactionPendingContext = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
>
type ReactionBoundary = Extract<SpatialMovementRuleEvaluation, { kind: 'REACTION_BOUNDARY' }>

type MovementReactionResolutionCommand =
  MovementReactionPendingContext['root']['resolutionCommands'][number]

/**
 * Appends one controller/GM selection to the same canonical movement
 * occurrence history. The caller advances persistence only after this exact
 * command has settled the frozen Kernel choice.
 */
export function appendEncounterMovementReactionResolutionCommand(input: {
  history: MovementReactionPendingContext['root']['resolutionCommands']
  command: MovementReactionResolutionCommand
  selection: MovementReactionChoiceSelectionDto
  actorUserId: string
  proposedOccurrenceVersion: number
}): MovementReactionPendingContext['root']['resolutionCommands'] {
  const command = movementReactionResolutionCommandDtoSchema.parse(input.command)
  const selection = movementReactionChoiceSelectionDtoSchema.parse(input.selection)
  if (
    input.proposedOccurrenceVersion !== input.history.length + 1 ||
    command.expectedOccurrenceVersion !== input.proposedOccurrenceVersion - 1 ||
    command.actorUserId !== input.actorUserId ||
    command.kind !== selection.kind ||
    (command.kind === 'OPTION' &&
      (selection.kind !== 'OPTION' || command.optionId !== selection.optionId)) ||
    input.history.some((entry) => entry.commandId === command.commandId)
  ) {
    throw new EncounterConflictError('The movement reaction resolution command is stale.')
  }
  return [...input.history, command]
}

/** Appends the dice answer to a Concentration check the move's own contact caused. */
export function appendEncounterMovementConcentrationEvidenceCommand(input: {
  history: MovementReactionPendingContext['root']['resolutionCommands']
  command: MovementReactionPendingContext['root']['resolutionCommands'][number]
  actorUserId: string
  proposedOccurrenceVersion: number
}): MovementReactionPendingContext['root']['resolutionCommands'] {
  const command = movementReactionActionEvidenceCommandDtoSchema.parse(input.command)
  if (
    input.proposedOccurrenceVersion !== input.history.length + 1 ||
    command.expectedOccurrenceVersion !== input.proposedOccurrenceVersion - 1 ||
    command.actorUserId !== input.actorUserId ||
    input.history.some((entry) => entry.commandId === command.commandId)
  ) {
    throw new EncounterConflictError('The movement Concentration evidence command is stale.')
  }
  return [...input.history, command]
}

/** Drops only the settled current choice and retains the exact frozen suffix. */
export function movementReactionRemainderAfterCurrentChoice(input: {
  context: MovementReactionPendingContext
  resolutionCommands: MovementReactionPendingContext['root']['resolutionCommands']
}): FrozenMovementReactionRemainder {
  if (input.context.phase.kind !== 'CHOICE')
    throw new EncounterConflictError('The movement reaction choice is not current.')
  return {
    root: {
      ...input.context.root,
      resolutionCommands: [...input.resolutionCommands]
    },
    spatialSelectionChecksum: input.context.spatialSelectionChecksum,
    spatialCurrentnessChecksum: input.context.spatialCurrentnessChecksum,
    completedSpatialExecutions: [...input.context.completedSpatialExecutions],
    appliedSpatialPrefix: input.context.appliedSpatialPrefix,
    currentSpatialCandidate: null,
    remainingSpatialCandidates: [...input.context.remainingSpatialCandidates],
    reactionTimeline: input.context.reactionTimeline.slice(1)
  }
}

/**
 * Converts a spatial-first staged boundary into the one Encounter-owned
 * reaction occurrence. The caller has committed only the Scene position at the
 * boundary; every mechanics result remains staged in this sealed continuation.
 */
export async function startEncounterMovementReactionAtBoundary(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  publishedChoice: ServerPublishedRuleDefinitionDto
  root: SpatialMovementRuleRoot
  currentSceneVersion: number
  boundary: ReactionBoundary
  reactionTimeline: MovementReactionTimelineDto
}): Promise<ServerKernelRuleExecutionPendingSnapshotDto> {
  const first = input.reactionTimeline[0]
  if (!first || Math.abs(first.group.pathDistance - input.boundary.boundaryDistance) > 1e-8) {
    throw new EncounterConflictError(
      'The movement reaction choice does not match the staged spatial boundary.'
    )
  }
  return startEncounterMovementReactionChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: input.gameSystemId,
    publishedChoice: input.publishedChoice,
    context: {
      root: {
        ...input.root,
        originalPath: input.root.originalPath.map((point) => ({ ...point })),
        currentSceneVersion: input.currentSceneVersion,
        pathChecksum: checksumRuleDocument(input.root.originalPath),
        pathStartDistance: input.boundary.boundaryDistance,
        currentPosition: input.boundary.boundaryPosition,
        resolutionCommands: [...input.boundary.resolutionCommands]
      },
      spatialSelectionChecksum: input.boundary.selectionChecksum,
      spatialCurrentnessChecksum: input.boundary.currentnessChecksum,
      completedSpatialExecutions: [...input.boundary.completedExecutions],
      appliedSpatialPrefix: input.boundary.appliedPrefix,
      remainingSpatialCandidates: [...input.boundary.remainingCandidates],
      reactionTimeline: input.reactionTimeline.map((entry) => ({
        ...entry,
        group: { ...entry.group, options: [...entry.group.options] }
      }))
    }
  })
}

async function startEncounterMovementReactionChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  publishedChoice: ServerPublishedRuleDefinitionDto
  context: Omit<
    MovementReactionPendingContext,
    'kind' | 'schemaVersion' | 'phase' | 'reactionSelectionChecksum'
  >
}): Promise<ServerKernelRuleExecutionPendingSnapshotDto> {
  const currentEntry = input.context.reactionTimeline[0]
  if (!currentEntry) {
    throw new EncounterConflictError('A movement reaction choice is unavailable.')
  }
  const currentChoice = currentEntry.group
  const choiceDefinitionId = currentChoice.options[0]!.policy.choiceDefinitionId
  if (
    !choiceDefinitionId ||
    currentChoice.options.some(
      (option) => option.policy.choiceDefinitionId !== choiceDefinitionId
    ) ||
    input.publishedChoice.id !== choiceDefinitionId ||
    input.publishedChoice.gameSystemId !== input.gameSystemId
  ) {
    throw new EncounterConflictError(
      'The movement reaction choice definition does not match its exact System policy.'
    )
  }
  const continuation = await startReactionChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    published: input.publishedChoice,
    optionCount: currentChoice.options.length + 1
  })
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    ...continuation,
    applicationContext: {
      kind: 'ENCOUNTER_MOVEMENT_REACTION',
      schemaVersion: 1,
      root: input.context.root,
      spatialSelectionChecksum: input.context.spatialSelectionChecksum,
      spatialCurrentnessChecksum: input.context.spatialCurrentnessChecksum,
      reactionSelectionChecksum: checksumRuleDocument(input.context.reactionTimeline),
      completedSpatialExecutions: input.context.completedSpatialExecutions,
      appliedSpatialPrefix: input.context.appliedSpatialPrefix,
      phase: { kind: 'CHOICE' },
      remainingSpatialCandidates: input.context.remainingSpatialCandidates,
      reactionTimeline: input.context.reactionTimeline
    }
  })
}

export async function resolveEncounterMovementReactionChoice(input: {
  runtime: RulesRuntimeService
  pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto
  selection: MovementReactionChoiceSelectionDto
}): Promise<
  | { kind: 'DECLINED'; context: MovementReactionPendingContext }
  | {
      kind: 'SELECTED'
      context: MovementReactionPendingContext
      option: MovementReactionChoiceGroupDto['options'][number]
    }
> {
  const context = input.pendingSnapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.phase.kind !== 'CHOICE' ||
    context.reactionSelectionChecksum !== checksumRuleDocument(context.reactionTimeline)
  ) {
    throw new EncounterConflictError(
      'The pending occurrence is not awaiting a movement reaction choice.'
    )
  }
  const selection = movementReactionChoiceSelectionDtoSchema.parse(input.selection)
  const currentEntry = context.reactionTimeline[0]
  if (!currentEntry) {
    throw new EncounterConflictError(
      'The pending occurrence is not awaiting a movement reaction choice.'
    )
  }
  const currentChoice = currentEntry.group
  const optionIndex =
    selection.kind === 'DECLINE'
      ? -1
      : currentChoice.options.findIndex((option) => option.optionId === selection.optionId)
  if (selection.kind === 'OPTION' && optionIndex < 0) {
    throw new EncounterConflictError('The selected movement reaction option was not issued.')
  }
  const {
    applicationContext: _applicationContext,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    snapshotKind: _snapshotKind,
    ...continuation
  } = input.pendingSnapshot
  const selectedIndex = optionIndex + 1
  await resumeReactionChoice({
    runtime: input.runtime,
    continuation,
    selectedIndex
  })
  if (selection.kind === 'DECLINE') return { kind: 'DECLINED', context }
  return {
    kind: 'SELECTED',
    context,
    option: currentChoice.options[optionIndex]!
  }
}
