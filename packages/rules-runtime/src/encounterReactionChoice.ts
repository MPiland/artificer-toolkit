import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  encounterReactionSelectionIdentity,
  encounterReactionUseOptionId,
  type EncounterCastReactionOfferDto,
  type EncounterReactionPinDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  chosenEncounterSealedOption,
  openEncounterSealedChoice,
  settleEncounterSealedChoice,
  type EncounterSealedChoiceSelection
} from './encounterSealedChoice.js'

/** The reaction a creature could be offered for what is happening to it or near it, as it stands now. */
export interface EncounterReactionCandidate {
  /** The authored trigger it answers, as the event hook that offered it named it. */
  trigger: EncounterReactionPinDto['trigger']
  reactorActorId: string
  /** The reacting Character; null for a creature reacting with its own authored action. */
  characterId: string | null
  characterStreamVersion: number | null
  actionId: string
  effectId: string
  allowance: { definitionId: string; beforeUsed: number; maximum: number }
  choiceGraph: ServerPublishedRuleDefinitionDto
}

/** The exact reaction, allowance and choice identity offered for one trigger. */
export function encounterReactionPin(
  candidate: EncounterReactionCandidate
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
function sameEncounterReactionCandidate(
  reaction: Pick<
    EncounterReactionPinDto,
    'selectionChecksum' | 'useOptionId' | 'allowanceBeforeUsed' | 'allowanceMaximum'
  >,
  candidate: EncounterReactionCandidate
) {
  const current = encounterReactionPin(candidate)
  return (
    current.selectionChecksum === reaction.selectionChecksum &&
    current.useOptionId === reaction.useOptionId &&
    current.allowanceBeforeUsed === reaction.allowanceBeforeUsed &&
    current.allowanceMaximum === reaction.allowanceMaximum
  )
}

/** Starts the sealed two-option choice; nothing is published until a decision settles it. */
export async function openEncounterReactionChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  candidate: EncounterReactionCandidate
}): Promise<ServerRuleExecutionContinuationDto> {
  return openEncounterSealedChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    graph: input.candidate.choiceGraph,
    optionCount: 1,
    declinable: true
  })
}

/**
 * The reaction a decision answers: the one whose use option was chosen, or the innermost for a decline.
 * An option the offer never issued is refused.
 */
export function chosenEncounterReaction<Pin extends { useOptionId: string }>(
  offer: { reactions: readonly Pin[] },
  selection: EncounterSealedChoiceSelection
) {
  const chosen =
    chosenEncounterSealedOption({
      options: offer.reactions,
      optionId: (reaction) => reaction.useOptionId,
      selection,
      label: 'Reaction'
    }) ?? offer.reactions[0]
  if (!chosen) throw new Error('Reaction selection was not issued.')
  return chosen
}

/** Opens the sealed two-option choice a pin names and answers it, refusing anything but that exact pin. */
async function settleSealedReactionChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  candidate: EncounterReactionCandidate
  reaction: Pick<EncounterReactionPinDto, 'choiceDefinitionId' | 'choiceDefinitionChecksum'>
  use: boolean
}) {
  const { reaction } = input
  return settleEncounterSealedChoice({
    runtime: input.runtime,
    continuation: await openEncounterReactionChoice(input),
    selectedIndex: input.use ? 1 : 0,
    pin: { definitionId: reaction.choiceDefinitionId, checksum: reaction.choiceDefinitionChecksum },
    label: 'Reaction'
  })
}

/**
 * Settles the sealed choice of a creature that uses its reaction to counter a cast. The offer and the
 * creature's facts must still be the ones it was made against; using the reaction spends nothing here,
 * the caller's commit does. Declining needs no kernel work: the cast goes on to the next creature.
 */
export async function settleEncounterCastReactionUse(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  offer: Pick<EncounterCastReactionOfferDto, 'reactions'>
  candidate: EncounterReactionCandidate
  optionId: string
}) {
  const reaction = chosenEncounterReaction(input.offer, {
    kind: 'OPTION',
    optionId: input.optionId
  })
  if (!sameEncounterReactionCandidate(reaction, input.candidate))
    throw new Error('Reaction evidence is stale.')
  const choice = await settleSealedReactionChoice({ ...input, reaction, use: true })
  return { reaction, choice }
}
