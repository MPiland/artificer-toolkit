import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  encounterReactionSelectionIdentity,
  encounterReactionUseOptionId,
  type EncounterReactionOfferDto,
  type EncounterReactionPinDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { startReactionChoice } from './reactionChoiceDefinition.js'

/** What the reacting creature's controller answers: declining, or the one option that uses the reaction. */
export type EncounterReactionSelection = { kind: 'DECLINE' } | { kind: 'OPTION'; optionId: string }

/** The reaction a hit attack could offer its target, as it stands now. */
export interface EncounterAttackReactionCandidate {
  trigger: EncounterReactionPinDto['trigger']
  reactorActorId: string
  characterId: string
  characterStreamVersion: number
  actionId: string
  effectId: string
  allowance: { definitionId: string; beforeUsed: number; maximum: number }
  choiceGraph: ServerPublishedRuleDefinitionDto
}

/** The exact reaction, allowance and choice identity offered for one hit. */
export function encounterReactionPin(
  candidate: EncounterAttackReactionCandidate
): EncounterReactionPinDto {
  const identity = {
    trigger: candidate.trigger,
    reactorActorId: candidate.reactorActorId,
    characterId: candidate.characterId,
    actionId: candidate.actionId,
    effectId: candidate.effectId,
    allowanceDefinitionId: candidate.allowance.definitionId,
    choiceDefinitionId: candidate.choiceGraph.id,
    choiceDefinitionChecksum: candidate.choiceGraph.checksum
  }
  const selectionChecksum = checksumRuleDocument(encounterReactionSelectionIdentity(identity))
  return {
    ...identity,
    characterStreamVersion: candidate.characterStreamVersion,
    allowanceBeforeUsed: candidate.allowance.beforeUsed,
    allowanceMaximum: candidate.allowance.maximum,
    useOptionId: encounterReactionUseOptionId(selectionChecksum),
    selectionChecksum
  }
}

/** Whether the freshly discovered candidate is still the one the pin was sealed against. */
export function sameEncounterReactionCandidate(
  reaction: EncounterReactionPinDto,
  candidate: EncounterAttackReactionCandidate
) {
  const current = encounterReactionPin(candidate)
  return (
    current.selectionChecksum === reaction.selectionChecksum &&
    current.useOptionId === reaction.useOptionId &&
    current.allowanceBeforeUsed === reaction.allowanceBeforeUsed &&
    current.allowanceMaximum === reaction.allowanceMaximum
  )
}

/** The interstitial audit a decided offer hands the sealed OUTCOME it selects. */
export function encounterReactionAudit(input: {
  offer: Pick<
    EncounterReactionOfferDto,
    'originalExecutionChecksum' | 'targetStateChecksum' | 'd20'
  >
  reaction: EncounterReactionPinDto
  selection: 'DECLINE' | 'USE'
  choiceExecution: ServerCompletedRuleExecutionDto
  adjustment: {
    defenseBefore: number
    defenseAfter: number
    adjustedBoundFactsChecksum: string
  } | null
}) {
  return {
    choiceExecution: input.choiceExecution,
    selection: input.selection,
    originalExecutionChecksum: input.offer.originalExecutionChecksum,
    targetStateChecksum: input.offer.targetStateChecksum,
    reaction: input.reaction,
    d20: input.offer.d20,
    adjustment: input.adjustment
  }
}

/** Starts the sealed two-option choice; nothing is published until a decision settles it. */
export async function openEncounterReactionChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  candidate: EncounterAttackReactionCandidate
}): Promise<ServerRuleExecutionContinuationDto> {
  return startReactionChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    published: input.candidate.choiceGraph,
    optionCount: 2
  })
}

/**
 * The reaction a decision answers: the one whose use option was chosen, or the innermost for a decline.
 * An option the offer never issued is refused.
 */
export function chosenEncounterReaction(
  offer: Pick<EncounterReactionOfferDto, 'reactions'>,
  selection: EncounterReactionSelection
) {
  const chosen =
    selection.kind === 'OPTION'
      ? offer.reactions.find((reaction) => reaction.useOptionId === selection.optionId)
      : offer.reactions[0]
  if (!chosen) throw new Error('Reaction selection was not issued.')
  return chosen
}

/**
 * Settles a sealed choice against its pin. The offer, the hit and the reactor's facts must all still be
 * the ones it was made against; using the reaction spends nothing here, the caller's commit does.
 */
export async function settleEncounterReactionChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  boundary: {
    execution: ServerCompletedRuleExecutionDto
    d20Policy: ServerRuleExecutionD20PolicyDto
  }
  offer: EncounterReactionOfferDto
  candidate: EncounterAttackReactionCandidate
  targetStateChecksum: string
  selection: EncounterReactionSelection
}) {
  const { boundary, offer } = input
  const reaction = chosenEncounterReaction(offer, input.selection)
  if (
    input.targetStateChecksum !== offer.targetStateChecksum ||
    checksumRuleDocument(boundary.execution) !== offer.originalExecutionChecksum ||
    checksumRuleDocument(boundary.d20Policy) !== checksumRuleDocument(offer.d20) ||
    !sameEncounterReactionCandidate(reaction, input.candidate)
  )
    throw new Error('Reaction evidence is stale.')
  if (
    boundary.execution.status !== 'COMPLETE' ||
    (boundary.execution.outputs.resultPath !== 'ON_HIT' &&
      boundary.execution.outputs.resultPath !== 'ON_CRIT')
  )
    throw new Error('A reaction to an attack requires sealed hit evidence.')
  const use = input.selection.kind === 'OPTION'
  const continuation = await openEncounterReactionChoice(input)
  if (
    continuation.graph.source.definitionId !== reaction.choiceDefinitionId ||
    continuation.graph.source.checksum !== reaction.choiceDefinitionChecksum
  )
    throw new Error('Reaction choice continuation pin is stale.')
  const choice = await input.runtime.resume({
    continuation,
    response: { requestId: continuation.request.requestId, value: use ? 1 : 0 }
  })
  if (
    choice.status !== 'COMPLETE' ||
    choice.evidence.source.definitionId !== reaction.choiceDefinitionId ||
    choice.evidence.source.checksum !== reaction.choiceDefinitionChecksum ||
    choice.outputs.selectedIndex !== (use ? 1 : 0)
  )
    throw new Error('Reaction choice did not settle its exact pin.')
  return { use, reaction, choice }
}
