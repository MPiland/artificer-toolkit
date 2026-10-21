import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RuleValue } from '@artificer-toolkit/shared/rules'

import { EncounterValidationError } from './encounterErrors.js'
import { createReactionChoiceDefinition, startReactionChoice } from './reactionChoiceDefinition.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/**
 * The one lifecycle every pending Encounter choice shares (ADR 0039 decision 3): open a sealed
 * bounded choice, take the option an answer names, and settle the choice with exactly that index.
 * What was offered, and whether it is still current, stays with each kind's own module.
 */

/** What a chooser answers: declining, or the one option it takes. */
export type EncounterSealedChoiceSelection =
  | { kind: 'DECLINE' }
  | { kind: 'OPTION'; optionId: string }

/**
 * Opens a sealed bounded choice over `optionCount` offered options: a System-owned graph by its id, or
 * one a feature already published. A declinable choice keeps index 0 for declining, so index `n` takes
 * the `n`th option; otherwise index `n` takes option `n + 1`. Nothing is published until a settle
 * answers it.
 */
export function openEncounterSealedChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  graph: { definitionId: string; gameSystemId: string } | ServerPublishedRuleDefinitionDto
  optionCount: number
  declinable: boolean
  /** The most options the offer may hold. */
  maxOptionCount?: number
}): Promise<ServerRuleExecutionContinuationDto> {
  return startReactionChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    published:
      'checksum' in input.graph ? input.graph : createReactionChoiceDefinition(input.graph),
    optionCount: input.optionCount + (input.declinable ? 1 : 0),
    maxOptionCount: input.maxOptionCount
  })
}

/**
 * Opens an authored two-option choice (index 0 declines, 1 uses) whose graph a feature publishes
 * itself, such as a creature's Legendary Resistance.
 */
export async function openEncounterAuthoredChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  published: ServerPublishedRuleDefinitionDto
  label: string
}) {
  const choice = await input.runtime.executeResolved({
    command: { definitionId: input.published.id, occurrenceId: input.occurrenceId, facts: {} },
    published: input.published
  })
  if (
    choice.status !== 'PAUSED' ||
    choice.continuation.request.nodeId !== 'choice' ||
    choice.continuation.request.min !== 0 ||
    choice.continuation.request.max !== 1
  )
    throw new Error(`${input.label} choice graph did not issue its exact bounded request.`)
  return choice
}

/** The option a selection takes, or null for a decline. An option the offer never issued is refused. */
export function chosenEncounterSealedOption<Option>(input: {
  options: readonly Option[]
  optionId: (option: Option) => string
  selection: EncounterSealedChoiceSelection
  label: string
}): Option | null {
  const { selection } = input
  if (selection.kind === 'DECLINE') return null
  const chosen = input.options.find((option) => input.optionId(option) === selection.optionId)
  if (chosen === undefined)
    throw new EncounterValidationError(`${input.label} selection was not issued.`)
  return chosen
}

/** The index a declinable choice is answered with: 0 declines, `n` takes the `n`th option. */
export function encounterSealedChoiceIndex<Option>(
  options: readonly Option[],
  option: Option | null
): number {
  return option === null ? 0 : options.indexOf(option) + 1
}

/**
 * Settles a sealed choice with exactly one index. A pinned choice must still be the pinned graph, before
 * and after it resumes; the completed choice must record that answer in `output` (`selectedIndex` for a
 * System-owned choice). Returns the completed choice: the evidence an audit seals.
 */
export async function settleEncounterSealedChoice(input: {
  runtime: RulesRuntimeService
  continuation: ServerRuleExecutionContinuationDto
  selectedIndex: number
  label: string
  pin?: { definitionId: string; checksum: string }
  output?: { key: string; value: RuleValue }
}): Promise<ServerCompletedRuleExecutionDto> {
  const { continuation, pin } = input
  const pinned = (source: { definitionId: string; checksum: string }) =>
    !pin || (source.definitionId === pin.definitionId && source.checksum === pin.checksum)
  if (!pinned(continuation.graph.source))
    throw new EncounterValidationError(`${input.label} choice continuation pin is stale.`)
  const choice = await input.runtime.resume({
    continuation,
    response: { requestId: continuation.request.requestId, value: input.selectedIndex }
  })
  const output = input.output ?? { key: 'selectedIndex', value: input.selectedIndex }
  if (
    choice.status !== 'COMPLETE' ||
    !pinned(choice.evidence.source) ||
    choice.outputs[output.key] !== output.value
  )
    throw new EncounterValidationError(`${input.label} choice did not settle its exact selection.`)
  return choice
}
