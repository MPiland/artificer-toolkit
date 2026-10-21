import {
  encounterOnHitUseOptionId,
  type EncounterOnHitAuditDto,
  type EncounterOnHitCost,
  type EncounterOnHitOfferDto,
  type EncounterOnHitOptionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionOnHitChoice'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { createReactionChoiceDefinition, startReactionChoice } from './reactionChoiceDefinition.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** The System-owned bounded-choice graph that holds an on-hit offer until its attacker decides. */
export const ENCOUNTER_ON_HIT_CHOICE_DEFINITION_ID = '8e5c2f0a-3d71-4b9e-a6c4-1f7d92b05e38'

/** What the attacker answers: declining every optional rider, or the one way of paying for one. */
export type EncounterOnHitSelection = { kind: 'DECLINE' } | { kind: 'OPTION'; optionId: string }

/** One way the attacker could pay for an optional on-hit rider as things stand now. */
export type EncounterOnHitCandidate = EncounterOnHitCost

/** The options offered for one hit: each candidate, identified by the hit it was offered for. */
export function encounterOnHitOptions(
  testExecutionChecksum: string,
  candidates: readonly EncounterOnHitCandidate[]
): EncounterOnHitOptionDto[] {
  return candidates.map((candidate) => ({
    ...candidate,
    useOptionId: encounterOnHitUseOptionId({ testExecutionChecksum, cost: candidate })
  }))
}

/** Starts the sealed bounded choice: index 0 declines, index `n` uses the `n`th option. */
export function openEncounterOnHitChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  optionCount: number
}): Promise<ServerRuleExecutionContinuationDto> {
  return startReactionChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    published: createReactionChoiceDefinition({
      definitionId: ENCOUNTER_ON_HIT_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    }),
    optionCount: input.optionCount + 1
  })
}

/** The option a decision answers, or null for a decline. An option the offer never issued is refused. */
export function chosenEncounterOnHit(
  offer: Pick<EncounterOnHitOfferDto, 'options'>,
  selection: EncounterOnHitSelection
): EncounterOnHitOptionDto | null {
  if (selection.kind === 'DECLINE') return null
  const chosen = offer.options.find((option) => option.useOptionId === selection.optionId)
  if (!chosen) throw new Error('On-hit selection was not issued.')
  return chosen
}

/** The record of a decided offer that the OUTCOME it selects is sealed against. */
export function encounterOnHitAudit(input: {
  offer: Pick<EncounterOnHitOfferDto, 'testExecutionChecksum'>
  option: EncounterOnHitOptionDto | null
}): EncounterOnHitAuditDto {
  return {
    selection: input.option ? 'USE' : 'DECLINE',
    testExecutionChecksum: input.offer.testExecutionChecksum,
    option: input.option
  }
}

/**
 * Settles a sealed choice against its offer. The hit must still be the one offered for and the chosen
 * way of paying must still be available; using a rider spends nothing here, the caller's commit does.
 */
export async function settleEncounterOnHitChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  boundary: {
    execution: ServerCompletedRuleExecutionDto
    d20Policy: ServerRuleExecutionD20PolicyDto
  }
  offer: EncounterOnHitOfferDto
  candidates: readonly EncounterOnHitCandidate[]
  selection: EncounterOnHitSelection
}) {
  const { boundary, offer } = input
  const option = chosenEncounterOnHit(offer, input.selection)
  if (
    checksumRuleDocument(boundary.execution) !== offer.testExecutionChecksum ||
    checksumRuleDocument(boundary.d20Policy) !== checksumRuleDocument(offer.d20) ||
    (option &&
      !input.candidates.some(
        (candidate) =>
          encounterOnHitUseOptionId({
            testExecutionChecksum: offer.testExecutionChecksum,
            cost: candidate
          }) === option.useOptionId
      ))
  )
    throw new Error('On-hit evidence is stale.')
  const selectedIndex = option ? offer.options.indexOf(option) + 1 : 0
  const continuation = await openEncounterOnHitChoice({
    ...input,
    optionCount: offer.options.length
  })
  const choice = await input.runtime.resume({
    continuation,
    response: { requestId: continuation.request.requestId, value: selectedIndex }
  })
  if (choice.status !== 'COMPLETE' || choice.outputs.selectedIndex !== selectedIndex)
    throw new Error('On-hit choice did not settle its exact selection.')
  return option
}
