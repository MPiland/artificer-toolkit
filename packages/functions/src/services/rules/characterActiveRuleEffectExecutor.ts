import {
  activeRuleEffectLifecycleDtoSchema,
  type ActiveRuleEffectLifecycleDto,
  type ServerCompletedRuleExecutionDto,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  CharacterActiveRuleEffectExecutionError,
  executeTargetBoundActiveRuleEffectWithPause,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithPause,
  type TargetBoundActiveRuleEffectExecutionInput,
  type TargetBoundActiveRuleEffectExecutionPaused,
  type TargetBoundActiveRuleEffectExecutionResult
} from './targetBoundActiveRuleEffectExecutor.js'

export { CharacterActiveRuleEffectExecutionError }

type ActiveEffectStage = 'START_OF_TURN' | 'END_OF_TURN'

export type CharacterActiveRuleEffectLifecycleProposal =
  | {
      kind: 'UPDATE'
      activeEffectId: string
      expectedVersion: number
      proposedAfterVersion: number
      beforeRemainingTicks: number | null
      afterRemainingTicks: number | null
      beforeLifecycleChecksum: string
      afterLifecycle: ActiveRuleEffectLifecycleDto
      afterLifecycleChecksum: string
    }
  | {
      kind: 'EXPIRE'
      activeEffectId: string
      expectedVersion: number
      beforeRemainingTicks: number | null
      afterRemainingTicks: 0 | null
      beforeLifecycleChecksum: string
    }

export interface CharacterActiveRuleEffectExecutionResult extends TargetBoundActiveRuleEffectExecutionResult {
  lifecycle: CharacterActiveRuleEffectLifecycleProposal
}

/** A sealed kernel pause; the Encounter turn-batch coordinator owns persistence. */
export type CharacterActiveRuleEffectExecutionPaused = TargetBoundActiveRuleEffectExecutionPaused

export interface CharacterActiveRuleEffectExecutionInput extends TargetBoundActiveRuleEffectExecutionInput {
  stage: ActiveEffectStage
}

function requireStage(value: string): ActiveEffectStage {
  if (value !== 'START_OF_TURN' && value !== 'END_OF_TURN') {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect execution requires a turn-boundary stage.'
    )
  }
  return value
}

function requireFirstTracerContract(input: CharacterActiveRuleEffectExecutionInput): number | null {
  const stage = requireStage(input.stage)
  const { recurrence } = input.definition
  if (
    recurrence.recurrenceStage !== stage ||
    recurrence.consumeOnFirstEvent !== null ||
    recurrence.endOnEvents.length !== 0 ||
    (recurrence.expiration.kind === 'TICKS' &&
      (recurrence.expiration.decrementStage !== stage ||
        input.lifecycle.remainingTicks === null ||
        input.lifecycle.remainingTicks < 1)) ||
    (recurrence.expiration.kind === 'INDEFINITE' && input.lifecycle.remainingTicks !== null)
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect lifecycle is not supported by the fixed recurring-effect executor.'
    )
  }
  if (
    input.lifecycle.remainingTicks !== null &&
    input.lifecycle.remainingTicks > 1 &&
    !Number.isSafeInteger(input.activeEffectVersion + 1)
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect version cannot advance beyond the supported safe integer range.'
    )
  }
  return input.lifecycle.remainingTicks
}

function lifecycleProposal(
  input: CharacterActiveRuleEffectExecutionInput,
  beforeRemainingTicks: number | null,
  terminal: boolean
): CharacterActiveRuleEffectLifecycleProposal {
  if (terminal) {
    return {
      kind: 'EXPIRE',
      activeEffectId: input.activeEffectId,
      expectedVersion: input.activeEffectVersion,
      beforeRemainingTicks,
      afterRemainingTicks: beforeRemainingTicks === null ? null : 0,
      beforeLifecycleChecksum: input.lifecycleChecksum
    }
  }
  if (beforeRemainingTicks === null) {
    const afterLifecycle = activeRuleEffectLifecycleDtoSchema.parse({
      schemaVersion: 1,
      remainingTicks: null
    })
    return {
      kind: 'UPDATE',
      activeEffectId: input.activeEffectId,
      expectedVersion: input.activeEffectVersion,
      proposedAfterVersion: input.activeEffectVersion + 1,
      beforeRemainingTicks: null,
      afterRemainingTicks: null,
      beforeLifecycleChecksum: input.lifecycleChecksum,
      afterLifecycle,
      afterLifecycleChecksum: checksumRuleDocument(afterLifecycle)
    }
  }
  if (beforeRemainingTicks === 1) {
    return {
      kind: 'EXPIRE',
      activeEffectId: input.activeEffectId,
      expectedVersion: input.activeEffectVersion,
      beforeRemainingTicks,
      afterRemainingTicks: 0,
      beforeLifecycleChecksum: input.lifecycleChecksum
    }
  }
  const afterLifecycle = activeRuleEffectLifecycleDtoSchema.parse({
    schemaVersion: 1,
    remainingTicks: beforeRemainingTicks - 1
  })
  return {
    kind: 'UPDATE',
    activeEffectId: input.activeEffectId,
    expectedVersion: input.activeEffectVersion,
    proposedAfterVersion: input.activeEffectVersion + 1,
    beforeRemainingTicks,
    afterRemainingTicks: beforeRemainingTicks - 1,
    beforeLifecycleChecksum: input.lifecycleChecksum,
    afterLifecycle,
    afterLifecycleChecksum: checksumRuleDocument(afterLifecycle)
  }
}

function withLifecycle(
  input: CharacterActiveRuleEffectExecutionInput,
  result: TargetBoundActiveRuleEffectExecutionResult,
  beforeRemainingTicks: number | null
): CharacterActiveRuleEffectExecutionResult {
  return { ...result, lifecycle: lifecycleProposal(input, beforeRemainingTicks, result.terminal) }
}

/** Reconstructs a completed turn-boundary effect without calling the runtime. */
export function reconstructCharacterActiveRuleEffectCompletion(input: {
  executionInput: CharacterActiveRuleEffectExecutionInput
  execution: ServerCompletedRuleExecutionDto
  d20Evidence?: ServerRuleExecutionD20EvidenceDto | null
}): CharacterActiveRuleEffectExecutionResult {
  const beforeRemainingTicks = requireFirstTracerContract(input.executionInput)
  return withLifecycle(
    input.executionInput,
    reconstructTargetBoundActiveRuleEffectCompletion(input),
    beforeRemainingTicks
  )
}

/** Executes one turn-bound recurrence; callers own all persistence and mutation. */
export async function executeCharacterActiveRuleEffectWithPause(
  input: CharacterActiveRuleEffectExecutionInput
): Promise<CharacterActiveRuleEffectExecutionResult | CharacterActiveRuleEffectExecutionPaused> {
  const beforeRemainingTicks = requireFirstTracerContract(input)
  const result = await executeTargetBoundActiveRuleEffectWithPause(input)
  return 'continuation' in result ? result : withLifecycle(input, result, beforeRemainingTicks)
}

/** Resumes a sealed turn-bound effect graph without recompiling or source reads. */
export async function resumeCharacterActiveRuleEffectWithPause(
  input: CharacterActiveRuleEffectExecutionInput & {
    continuation: ServerRuleExecutionContinuationDto
    resolution: { requestId: string; rawFaces: readonly number[] }
    expectedEvidencePolicy?: ServerRuleExecutionD20PolicyDto | null
  }
): Promise<CharacterActiveRuleEffectExecutionResult | CharacterActiveRuleEffectExecutionPaused> {
  const beforeRemainingTicks = requireFirstTracerContract(input)
  const result = await resumeTargetBoundActiveRuleEffectWithPause(input)
  return 'continuation' in result ? result : withLifecycle(input, result, beforeRemainingTicks)
}

/** Legacy automatic caller: a pause is not valid outside the dedicated batch coordinator. */
export async function executeCharacterActiveRuleEffect(
  input: CharacterActiveRuleEffectExecutionInput
): Promise<CharacterActiveRuleEffectExecutionResult> {
  const result = await executeCharacterActiveRuleEffectWithPause(input)
  if ('continuation' in result) {
    throw new CharacterActiveRuleEffectExecutionError(
      'The fixed recurring-effect executor cannot persist a paused rule execution.'
    )
  }
  return result
}
