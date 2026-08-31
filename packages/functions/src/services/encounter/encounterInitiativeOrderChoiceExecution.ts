import type { InitiativePolicyOrderChoiceGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RuleValue } from '@artificer-toolkit/shared/rules'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { initiativePublishedGraph } from './encounterInitiativeGraphExecution.js'

type InitiativeGraphSnapshot = EncounterInitiativePolicySnapshotDto['orderChoiceGraph']

export type InitiativeOrderChoiceResult = {
  kind: 'COMPLETE'
  selection: number
  execution: ServerCompletedRuleExecutionDto
}

export type InitiativeOrderChoiceExecution =
  | { kind: 'PENDING'; continuation: ServerRuleExecutionContinuationDto }
  | InitiativeOrderChoiceResult

function requireCompatiblePin(
  graph: InitiativeGraphSnapshot,
  pin: InitiativePolicyOrderChoiceGraphPinDto
): void {
  if (
    graph.definitionId !== pin.definitionId ||
    graph.definitionVersion !== pin.definitionVersion ||
    graph.definitionChecksum !== pin.definitionChecksum ||
    graph.document.id !== graph.definitionId
  ) {
    throw new Error('Initiative order-choice graph does not match its exact policy pin.')
  }
}

function requireBounds(minimum: number, maximum: number): void {
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    minimum < 0 ||
    maximum < minimum ||
    maximum >= AUTHORED_LIMITS.nestedCollectionItems
  ) {
    throw new Error('Initiative order-choice bounds must be a finite integer range.')
  }
}

function requireSelection(
  execution: ServerCompletedRuleExecutionDto,
  pin: InitiativePolicyOrderChoiceGraphPinDto,
  minimum: number,
  maximum: number
): InitiativeOrderChoiceResult {
  const selection = execution.outputs[pin.selectionOutput]
  if (
    typeof selection !== 'number' ||
    !Number.isInteger(selection) ||
    selection < minimum ||
    selection > maximum
  ) {
    throw new Error('Initiative order-choice output is not an integer within the issued range.')
  }
  return { kind: 'COMPLETE', selection, execution }
}

function requirePausedRequest(
  continuation: ServerRuleExecutionContinuationDto,
  pin: InitiativePolicyOrderChoiceGraphPinDto,
  minimum: number,
  maximum: number
): void {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== minimum ||
    continuation.request.max !== maximum
  ) {
    throw new Error('Initiative order-choice request does not match its exact bounded range.')
  }
  if (
    continuation.graph.source.definitionId !== pin.definitionId ||
    continuation.graph.source.checksum !== pin.definitionChecksum
  ) {
    throw new Error('Initiative order-choice continuation does not match its exact graph pin.')
  }
}

export async function startInitiativeOrderChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeGraphSnapshot
  pin: InitiativePolicyOrderChoiceGraphPinDto
  minimumIndex: number
  maximumIndex: number
  facts?: Readonly<Record<string, RuleValue>>
}): Promise<InitiativeOrderChoiceExecution> {
  requireCompatiblePin(input.graph, input.pin)
  requireBounds(input.minimumIndex, input.maximumIndex)
  const execution = await input.runtime.executeResolved({
    command: {
      definitionId: input.graph.definitionId,
      occurrenceId: input.occurrenceId,
      facts: {
        ...(input.facts ?? {}),
        [input.pin.minimumIndexFact]: input.minimumIndex,
        [input.pin.maximumIndexFact]: input.maximumIndex
      }
    },
    published: initiativePublishedGraph({ gameSystemId: input.gameSystemId, graph: input.graph })
  })
  if (execution.status === 'PAUSED') {
    requirePausedRequest(execution.continuation, input.pin, input.minimumIndex, input.maximumIndex)
    return { kind: 'PENDING', continuation: execution.continuation }
  }
  return requireSelection(execution, input.pin, input.minimumIndex, input.maximumIndex)
}

export async function resumeInitiativeOrderChoice(input: {
  runtime: RulesRuntimeService
  continuation: ServerRuleExecutionContinuationDto
  requestId: string
  value: number
  pin: InitiativePolicyOrderChoiceGraphPinDto
  minimumIndex: number
  maximumIndex: number
}): Promise<InitiativeOrderChoiceExecution> {
  requireBounds(input.minimumIndex, input.maximumIndex)
  requirePausedRequest(input.continuation, input.pin, input.minimumIndex, input.maximumIndex)
  if (
    input.requestId !== input.continuation.request.requestId ||
    !Number.isInteger(input.value) ||
    input.value < input.minimumIndex ||
    input.value > input.maximumIndex
  ) {
    throw new Error('Initiative order-choice evidence does not match the issued request.')
  }
  const execution = await input.runtime.resume({
    continuation: input.continuation,
    response: { requestId: input.requestId, value: input.value }
  })
  if (execution.status === 'PAUSED') {
    throw new Error('Initiative order-choice graph requested an unsupported additional pause.')
  }
  return requireSelection(execution, input.pin, input.minimumIndex, input.maximumIndex)
}
