import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerCompletedRuleExecutionDto,
  type ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { InitiativePolicyGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type { RuleValue } from '@artificer-toolkit/shared/rules'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'

type InitiativeGraphSnapshot = EncounterInitiativePolicySnapshotDto['evaluationGraph']

export type SettledInitiativeScore = {
  automatic: true
  score: number
  sortDirection: InitiativePolicyGraphPinDto['sortDirection']
  execution: ServerCompletedRuleExecutionDto
}

export type UnavailableInitiativeScore = {
  automatic: false
  score: null
  sortDirection: InitiativePolicyGraphPinDto['sortDirection']
  execution: ServerCompletedRuleExecutionDto
}

export type InitiativeScoreExecution = SettledInitiativeScore | UnavailableInitiativeScore

export type InitiativeScoreStartResult =
  | { kind: 'PENDING'; continuation: ServerRuleExecutionContinuationDto }
  | { kind: 'COMPLETE'; result: InitiativeScoreExecution }

function requireInitiativeScore(
  execution: ServerCompletedRuleExecutionDto,
  pin: InitiativePolicyGraphPinDto
): InitiativeScoreExecution {
  const automatic = execution.outputs[pin.automaticOutput]
  const score = execution.outputs[pin.scoreOutput]
  if (typeof automatic !== 'boolean' || typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error('Initiative graph outputs do not match their exact policy bindings.')
  }
  return automatic
    ? { automatic: true, score, sortDirection: pin.sortDirection, execution }
    : { automatic: false, score: null, sortDirection: pin.sortDirection, execution }
}

/** Reconstructs only the runtime envelope already frozen by Encounter admission. */
export function initiativePublishedGraph(input: {
  gameSystemId: string
  graph: InitiativeGraphSnapshot
}) {
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: input.graph.definitionId,
    gameSystemId: input.gameSystemId,
    definitionFamilyKey: input.graph.document.definitionFamilyKey,
    checksum: input.graph.definitionChecksum,
    definition: input.graph.document
  })
}

export async function startInitiativeScoreGraph(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeGraphSnapshot
  pin: InitiativePolicyGraphPinDto
  facts: Readonly<Record<string, RuleValue>>
}): Promise<InitiativeScoreStartResult> {
  const execution = await input.runtime.executeResolved({
    command: {
      definitionId: input.graph.definitionId,
      occurrenceId: input.occurrenceId,
      facts: input.facts
    },
    published: initiativePublishedGraph(input)
  })
  return execution.status === 'PAUSED'
    ? { kind: 'PENDING', continuation: execution.continuation }
    : { kind: 'COMPLETE', result: requireInitiativeScore(execution, input.pin) }
}

export async function resumeInitiativeScoreGraph(input: {
  runtime: RulesRuntimeService
  continuation: ServerRuleExecutionContinuationDto
  requestId: string
  value: number
  pin: InitiativePolicyGraphPinDto
}): Promise<InitiativeScoreStartResult> {
  const execution = await input.runtime.resume({
    continuation: input.continuation,
    response: { requestId: input.requestId, value: input.value }
  })
  return execution.status === 'PAUSED'
    ? { kind: 'PENDING', continuation: execution.continuation }
    : { kind: 'COMPLETE', result: requireInitiativeScore(execution, input.pin) }
}

export function compareInitiativeScores(
  left: SettledInitiativeScore,
  right: SettledInitiativeScore
): number {
  if (left.sortDirection !== right.sortDirection) {
    throw new Error('Initiative scores from different order directions cannot be compared.')
  }
  return left.sortDirection === 'ASCENDING' ? left.score - right.score : right.score - left.score
}
