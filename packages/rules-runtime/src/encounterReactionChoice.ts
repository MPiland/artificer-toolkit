import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  encounterReactionSelectionIdentity,
  encounterReactionUseOptionId,
  type EncounterCastReactionOfferDto,
  type EncounterCastReactionPinDto,
  type EncounterReactionOfferDto,
  type EncounterReactionPinDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { v5 as uuidv5 } from 'uuid'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { startReactionChoice } from './reactionChoiceDefinition.js'

/** What the reacting creature's controller answers: declining, or the one option that uses the reaction. */
export type EncounterReactionSelection = { kind: 'DECLINE' } | { kind: 'OPTION'; optionId: string }

/** The reaction a creature could be offered for what is happening to it or near it, as it stands now. */
export interface EncounterReactionCandidate<Trigger extends string> {
  trigger: Trigger
  reactorActorId: string
  /** The reacting Character; null for a creature reacting with its own authored action. */
  characterId: string | null
  characterStreamVersion: number | null
  actionId: string
  effectId: string
  allowance: { definitionId: string; beforeUsed: number; maximum: number }
  choiceGraph: ServerPublishedRuleDefinitionDto
}

/** A hit attack's reaction candidate. */
export type EncounterAttackReactionCandidate = EncounterReactionCandidate<
  EncounterReactionPinDto['trigger']
>

/** A reaction to a cast. */
export type EncounterCastReactionCandidate = EncounterReactionCandidate<
  EncounterCastReactionPinDto['trigger']
>

/** The exact reaction, allowance and choice identity offered for one trigger. */
export function encounterReactionPin<Trigger extends string>(
  candidate: EncounterReactionCandidate<Trigger>
) {
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
  reaction: Pick<
    EncounterReactionPinDto,
    'selectionChecksum' | 'useOptionId' | 'allowanceBeforeUsed' | 'allowanceMaximum'
  >,
  candidate: EncounterReactionCandidate<string>
) {
  const current = encounterReactionPin(candidate)
  return (
    current.selectionChecksum === reaction.selectionChecksum &&
    current.useOptionId === reaction.useOptionId &&
    current.allowanceBeforeUsed === reaction.allowanceBeforeUsed &&
    current.allowanceMaximum === reaction.allowanceMaximum
  )
}

const reactionEffectNamespace = 'c2a9f1d4-5b3e-4e7a-8d60-1f4b7a92e5c3'

/**
 * The id of the effect a used reaction leaves on its reactor: a replay of the command mints the same
 * one. A cast several creatures react to names each `reactorActorId`, so each leaves its own.
 */
export function encounterReactionEffectId(input: {
  commandId: string
  occurrenceId: string
  reactorActorId?: string
}) {
  return uuidv5(
    [input.commandId, input.occurrenceId, input.reactorActorId].filter(Boolean).join(':'),
    reactionEffectNamespace
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
  candidate: EncounterReactionCandidate<string>
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
export function chosenEncounterReaction<Pin extends { useOptionId: string }>(
  offer: { reactions: readonly Pin[] },
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
  offer: Pick<
    EncounterReactionOfferDto,
    'reactions' | 'targetStateChecksum' | 'originalExecutionChecksum' | 'd20'
  >
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
  const choice = await settleSealedReactionChoice({ ...input, reaction, use })
  return { use, reaction, choice }
}

/** Opens the sealed two-option choice a pin names and answers it, refusing anything but that exact pin. */
async function settleSealedReactionChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  candidate: EncounterReactionCandidate<string>
  reaction: Pick<EncounterReactionPinDto, 'choiceDefinitionId' | 'choiceDefinitionChecksum'>
  use: boolean
}) {
  const { reaction, use } = input
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
  return choice
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
  candidate: EncounterCastReactionCandidate
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
