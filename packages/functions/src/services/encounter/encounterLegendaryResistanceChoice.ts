import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import { EncounterConflictError } from './encounterErrors.js'

export type EncounterLegendaryResistanceSelection = 'DECLINE' | 'USE'

export interface EncounterLegendaryResistanceChoiceEvidence {
  lifecycle: EncounterLegendaryResistanceCandidate['lifecycle']
  selectedIndex: 0 | 1
  use: boolean
  execution: ServerCompletedRuleExecutionDto
}

/** Begins the exact pinned two-option choice graph without any action/effect execution. */
export async function startEncounterLegendaryResistanceChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  candidate: EncounterLegendaryResistanceCandidate
}): Promise<ServerRuleExecutionContinuationDto> {
  const execution = await input.runtime.executeResolved({
    command: {
      definitionId: input.candidate.choiceGraph.id,
      occurrenceId: input.occurrenceId,
      facts: {}
    },
    published: input.candidate.choiceGraph
  })
  if (
    execution.status !== 'PAUSED' ||
    execution.continuation.request.nodeId !== 'choice' ||
    execution.continuation.request.min !== 0 ||
    execution.continuation.request.max !== 1
  ) {
    throw new EncounterConflictError(
      'Legendary Resistance choice graph did not issue its exact bounded request.'
    )
  }
  return execution.continuation
}

/** Settles the issued graph once; DECLINE is index zero and USE is index one. */
export async function resumeEncounterLegendaryResistanceChoice(input: {
  runtime: RulesRuntimeService
  continuation: ServerRuleExecutionContinuationDto
  candidate: EncounterLegendaryResistanceCandidate
  selection: EncounterLegendaryResistanceSelection
}): Promise<EncounterLegendaryResistanceChoiceEvidence> {
  if (
    input.continuation.graph.source.definitionId !== input.candidate.choiceGraph.id ||
    input.continuation.graph.source.gameSystemId !== input.candidate.choiceGraph.gameSystemId ||
    input.continuation.graph.source.definitionFamilyKey !==
      input.candidate.choiceGraph.definitionFamilyKey ||
    input.continuation.graph.source.checksum !== input.candidate.choiceGraph.checksum ||
    input.candidate.lifecycle.choiceGraphDefinitionId !== input.candidate.choiceGraph.id ||
    input.candidate.lifecycle.choiceGraphDefinitionChecksum !== input.candidate.choiceGraph.checksum
  ) {
    throw new EncounterConflictError('Legendary Resistance choice continuation pin is stale.')
  }
  const selectedIndex = input.selection === 'USE' ? 1 : 0
  const execution = await input.runtime.resume({
    continuation: input.continuation,
    response: { requestId: input.continuation.request.requestId, value: selectedIndex }
  })
  if (
    execution.status !== 'COMPLETE' ||
    execution.evidence.source.definitionId !== input.candidate.choiceGraph.id ||
    execution.evidence.source.checksum !== input.candidate.choiceGraph.checksum ||
    execution.outputs[input.candidate.lifecycle.useOutput] !== (selectedIndex === 1)
  ) {
    throw new EncounterConflictError('Legendary Resistance choice did not settle its exact pin.')
  }
  return {
    lifecycle: input.candidate.lifecycle,
    selectedIndex,
    use: selectedIndex === 1,
    execution
  }
}
