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

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  chosenEncounterSealedOption,
  encounterSealedChoiceIndex,
  openEncounterSealedChoice,
  settleEncounterSealedChoice,
  type EncounterSealedChoiceSelection
} from './encounterSealedChoice.js'

/** The System-owned bounded-choice graph that holds an on-hit offer until its attacker decides. */
export const ENCOUNTER_ON_HIT_CHOICE_DEFINITION_ID = '8e5c2f0a-3d71-4b9e-a6c4-1f7d92b05e38'

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
  return openEncounterSealedChoice({
    ...input,
    graph: {
      definitionId: ENCOUNTER_ON_HIT_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    },
    declinable: true
  })
}

/** The option a decision answers, or null for a decline. An option the offer never issued is refused. */
export function chosenEncounterOnHit(
  offer: Pick<EncounterOnHitOfferDto, 'options'>,
  selection: EncounterSealedChoiceSelection
): EncounterOnHitOptionDto | null {
  return chosenEncounterSealedOption({
    options: offer.options,
    optionId: (option) => option.useOptionId,
    selection,
    label: 'On-hit'
  })
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
  selection: EncounterSealedChoiceSelection
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
  await settleEncounterSealedChoice({
    runtime: input.runtime,
    continuation: await openEncounterOnHitChoice({ ...input, optionCount: offer.options.length }),
    selectedIndex: encounterSealedChoiceIndex(offer.options, option),
    label: 'On-hit'
  })
  return option
}
