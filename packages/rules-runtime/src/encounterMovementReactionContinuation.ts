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
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionPendingApplicationContextDto,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  resumeMovementReactionChoice,
  startMovementReactionChoice
} from './movementReactionChoice.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
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

function currentTimelineOptions(context: MovementReactionPendingContext) {
  const entry = context.reactionTimeline[0]
  if (!entry) throw new EncounterConflictError('A movement reaction timeline entry is unavailable.')
  return entry.group.options
}

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

/** Appends one exact dice or integer response for a selected reaction action. */
export function appendEncounterMovementReactionActionEvidenceCommand(input: {
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
    throw new EncounterConflictError('The movement reaction action evidence command is stale.')
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
    completedReactionExecutions: [...input.context.completedReactionExecutions],
    currentSpatialCandidate: null,
    remainingSpatialCandidates: [...input.context.remainingSpatialCandidates],
    reactionTimeline: input.context.reactionTimeline.slice(1)
  }
}

/** Drops the selected choice only after its action and allowance have committed. */
export function movementReactionRemainderAfterCompletedAction(input: {
  context: MovementReactionPendingContext
  selectedOptionId: string
  resolutionCommands: MovementReactionPendingContext['root']['resolutionCommands']
  execution: MovementReactionPendingContext['completedReactionExecutions'][number]
}): FrozenMovementReactionRemainder {
  const selected = currentTimelineOptions(input.context).find(
    (option) => option.optionId === input.selectedOptionId
  )
  if (
    !selected ||
    (input.context.phase.kind !== 'CHOICE' &&
      ((input.context.phase.kind !== 'ACTION_EVIDENCE' &&
        input.context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE') ||
        input.context.phase.selectedOptionId !== input.selectedOptionId)) ||
    input.execution.option.optionId !== input.selectedOptionId ||
    input.execution.ordinal !== input.context.completedReactionExecutions.length
  ) {
    throw new EncounterConflictError('The completed movement reaction action is stale.')
  }
  return {
    root: {
      ...input.context.root,
      resolutionCommands: [...input.resolutionCommands]
    },
    spatialSelectionChecksum: input.context.spatialSelectionChecksum,
    spatialCurrentnessChecksum: input.context.spatialCurrentnessChecksum,
    completedSpatialExecutions: [...input.context.completedSpatialExecutions],
    appliedSpatialPrefix: input.context.appliedSpatialPrefix,
    completedReactionExecutions: [...input.context.completedReactionExecutions, input.execution],
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
      completedReactionExecutions: [...input.boundary.completedReactionExecutions],
      remainingSpatialCandidates: [...input.boundary.remainingCandidates],
      reactionTimeline: input.reactionTimeline.map((entry) => ({
        ...entry,
        group: { ...entry.group, options: [...entry.group.options] }
      }))
    }
  })
}

export async function startEncounterMovementReactionChoice(input: {
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
  const continuation = await startMovementReactionChoice({
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
      completedReactionExecutions: input.context.completedReactionExecutions,
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
  await resumeMovementReactionChoice({
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

export function retainEncounterMovementReactionActionEvidence(input: {
  continuation: ServerRuleExecutionContinuationDto
  context: MovementReactionPendingContext
  selectedOptionId: string
  rollerActorId: string
  d20Policy: Extract<
    MovementReactionPendingContext['phase'],
    { kind: 'ACTION_EVIDENCE' }
  >['d20Policy']
  twoPhase?: Extract<
    MovementReactionPendingContext['phase'],
    { kind: 'ACTION_EVIDENCE' }
  >['twoPhase']
  phaseReceipts?: ServerKernelRuleExecutionPendingSnapshotDto['phaseReceipts']
}): ServerKernelRuleExecutionPendingSnapshotDto {
  const legendaryResistance =
    input.context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE' ? input.context.phase : null
  if (
    (input.context.phase.kind !== 'CHOICE' &&
      ((input.context.phase.kind !== 'ACTION_EVIDENCE' &&
        input.context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE') ||
        input.context.phase.selectedOptionId !== input.selectedOptionId)) ||
    !currentTimelineOptions(input.context).some(
      (option) => option.optionId === input.selectedOptionId
    )
  ) {
    throw new EncounterConflictError(
      'Reaction action evidence does not match an exact issued choice.'
    )
  }
  if (input.context.phase.kind === 'ACTION_EVIDENCE') {
    const prior = input.context.phase.twoPhase
    const next = input.twoPhase
    if (
      Boolean(prior) !== Boolean(next) ||
      (prior &&
        next &&
        (prior.compilerSourceChecksum !== next.compilerSourceChecksum ||
          prior.testTemplateChecksum !== next.testTemplateChecksum ||
          prior.boundFactsChecksum !== next.boundFactsChecksum ||
          (prior.phase === 'OUTCOME' &&
            (next.phase !== 'OUTCOME' ||
              prior.outcomeTemplateChecksum !== next.outcomeTemplateChecksum ||
              prior.testExecutionChecksum !== next.testExecutionChecksum ||
              checksumRuleDocument(prior.testRollEvidence) !==
                checksumRuleDocument(next.testRollEvidence)))))
    )
      throw new EncounterConflictError(
        'Reaction action evidence cannot replace its sealed phase identity.'
      )
  }
  if (
    legendaryResistance &&
    (input.twoPhase?.phase !== 'OUTCOME' ||
      input.twoPhase.testExecutionChecksum !== legendaryResistance.originalExecutionChecksum ||
      input.twoPhase.testRollEvidence.requestId !== legendaryResistance.originalD20.requestId ||
      input.twoPhase.testRollEvidence.rollMode !== legendaryResistance.originalD20.rollMode ||
      input.twoPhase.testRollEvidence.selectedNatural !==
        legendaryResistance.originalD20.selectedNatural ||
      checksumRuleDocument(input.twoPhase.testRollEvidence.rawFaces) !==
        checksumRuleDocument(legendaryResistance.originalD20.rawFaces) ||
      !input.twoPhase.legendaryResistance ||
      input.twoPhase.legendaryResistance.originalExecutionChecksum !==
        legendaryResistance.originalExecutionChecksum ||
      input.twoPhase.legendaryResistance.targetStateChecksum !==
        legendaryResistance.targetStateChecksum ||
      checksumRuleDocument(input.twoPhase.legendaryResistance.resistance) !==
        checksumRuleDocument(legendaryResistance.resistance))
  )
    throw new EncounterConflictError(
      'Legendary Resistance outcome evidence does not match its sealed TEST identity.'
    )
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    ...input.continuation,
    ...(input.phaseReceipts ? { phaseReceipts: input.phaseReceipts } : {}),
    applicationContext: {
      ...input.context,
      phase: {
        kind: 'ACTION_EVIDENCE',
        selectedOptionId: input.selectedOptionId,
        rollerActorId: input.rollerActorId,
        d20Policy: input.d20Policy,
        ...(input.twoPhase !== undefined ? { twoPhase: input.twoPhase } : {})
      }
    }
  })
}

export function legendaryResistanceUseOptionId(input: { selectionChecksum: string }): string {
  return checksumRuleDocument({ kind: 'USE', selectionChecksum: input.selectionChecksum })
}

export function createEncounterLegendaryResistancePhase(
  input: Pick<
    Parameters<typeof retainEncounterLegendaryResistanceChoice>[0],
    'selectedOptionId' | 'execution' | 'd20' | 'candidate' | 'targetStateChecksum'
  >
): Extract<MovementReactionPendingContext['phase'], { kind: 'LEGENDARY_RESISTANCE_CHOICE' }> {
  const selectionChecksum = checksumRuleDocument({
    targetActorId: input.candidate.targetActorId,
    ownerFeatureId: input.candidate.ownerFeatureId,
    chargeId: input.candidate.chargeId,
    featureCost: input.candidate.featureCost,
    definitionId: input.candidate.lifecycle.definitionId,
    definitionVersion: input.candidate.lifecycle.definitionVersion,
    definitionChecksum: input.candidate.lifecycle.definitionChecksum,
    choiceGraphDefinitionId: input.candidate.lifecycle.choiceGraphDefinitionId,
    choiceGraphDefinitionVersion: input.candidate.lifecycle.choiceGraphDefinitionVersion,
    choiceGraphDefinitionChecksum: input.candidate.lifecycle.choiceGraphDefinitionChecksum
  })
  return {
    kind: 'LEGENDARY_RESISTANCE_CHOICE',
    selectedOptionId: input.selectedOptionId,
    originalExecution: input.execution,
    originalD20: input.d20,
    originalExecutionChecksum: checksumRuleDocument(input.execution),
    targetStateChecksum: input.targetStateChecksum,
    resistance: {
      targetActorId: input.candidate.targetActorId,
      ownerFeatureId: input.candidate.ownerFeatureId,
      chargeId: input.candidate.chargeId,
      featureCost: input.candidate.featureCost,
      poolBefore: input.candidate.poolBefore,
      poolRemaining: input.candidate.poolRemaining,
      definitionId: input.candidate.lifecycle.definitionId,
      definitionVersion: input.candidate.lifecycle.definitionVersion,
      definitionChecksum: input.candidate.lifecycle.definitionChecksum,
      choiceGraphDefinitionId: input.candidate.lifecycle.choiceGraphDefinitionId,
      choiceGraphDefinitionVersion: input.candidate.lifecycle.choiceGraphDefinitionVersion,
      choiceGraphDefinitionChecksum: input.candidate.lifecycle.choiceGraphDefinitionChecksum,
      useOutput: input.candidate.lifecycle.useOutput,
      useOptionId: legendaryResistanceUseOptionId({ selectionChecksum }),
      selectionChecksum
    }
  }
}

/**
 * Replaces a completed failed save with the sealed Legendary Resistance
 * choice. The original action evidence remains immutable and no outcome is
 * applied until the same occurrence resumes.
 */
export function retainEncounterLegendaryResistanceChoice(input: {
  continuation: ServerRuleExecutionContinuationDto
  context: MovementReactionPendingContext
  selectedOptionId: string
  execution: MovementReactionPendingContext['completedReactionExecutions'][number]['execution']
  d20: ServerRuleExecutionD20EvidenceDto
  candidate: EncounterLegendaryResistanceCandidate
  targetStateChecksum: string
}): ServerKernelRuleExecutionPendingSnapshotDto {
  if (input.context.phase.kind !== 'CHOICE' && input.context.phase.kind !== 'ACTION_EVIDENCE') {
    throw new EncounterConflictError(
      'Legendary Resistance may replace only a current reaction action.'
    )
  }
  if (
    !currentTimelineOptions(input.context).some(
      (option) => option.optionId === input.selectedOptionId
    )
  ) {
    throw new EncounterConflictError('Legendary Resistance action selection is stale.')
  }
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    ...input.continuation,
    applicationContext: {
      ...input.context,
      phase: createEncounterLegendaryResistancePhase(input)
    }
  })
}
