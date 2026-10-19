import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterAttackRetargetUseOptionId,
  type EncounterAttackRetargetOfferDto,
  type EncounterAttackRetargetOptionDto,
  type EncounterFailedIncomingGateDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'

import { createReactionChoiceDefinition, startReactionChoice } from './reactionChoiceDefinition.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** The System-owned bounded-choice graph that holds a retarget offer until its attacker decides. */
export const ENCOUNTER_ATTACK_RETARGET_CHOICE_DEFINITION_ID = '4b8d1e6a-7c93-4f25-b0a8-d3e5f9172c64'

/** What the attacker answers: letting the action be lost, or the one creature to turn it on. */
export type EncounterAttackRetargetSelection =
  | { kind: 'DECLINE' }
  | { kind: 'OPTION'; optionId: string }

/** A creature the lost action could be turned on, with its token on the action's Scene when it names one. */
export type EncounterAttackRetargetCandidate = { actorId: string; tokenId: string | null }

/** The offer made for one failed ward save: each candidate, identified by the ward that stopped the action. */
export function encounterAttackRetargetOffer(
  gate: EncounterFailedIncomingGateDto,
  candidates: readonly EncounterAttackRetargetCandidate[]
): EncounterAttackRetargetOfferDto {
  return {
    gate,
    options: candidates.map(({ actorId, tokenId }) => ({
      targetActorId: actorId,
      targetTokenId: tokenId,
      useOptionId: encounterAttackRetargetUseOptionId({
        gateEffectId: gate.effectId,
        targetActorId: actorId
      })
    }))
  }
}

/** Starts the sealed bounded choice: index 0 declines, index `n` turns the action on the `n`th creature. */
export function openEncounterAttackRetargetChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  optionCount: number
}): Promise<ServerRuleExecutionContinuationDto> {
  return startReactionChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    published: createReactionChoiceDefinition({
      definitionId: ENCOUNTER_ATTACK_RETARGET_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    }),
    optionCount: input.optionCount + 1
  })
}

/** The creature a decision turns the action on, or null for a decline. An option never offered is refused. */
export function chosenEncounterAttackRetarget(
  offer: Pick<EncounterAttackRetargetOfferDto, 'options'>,
  selection: EncounterAttackRetargetSelection
): EncounterAttackRetargetOptionDto | null {
  if (selection.kind === 'DECLINE') return null
  const chosen = offer.options.find((option) => option.useOptionId === selection.optionId)
  if (!chosen) throw new Error('Retarget selection was not issued.')
  return chosen
}

/**
 * The action turned on the creature a retarget chose: everything the attacker named stays, only the
 * creature (and its token, when the action names a Scene) changes.
 */
export function retargetEncounterAction(
  command: ResolveEncounterActionInputDto,
  option: Pick<EncounterAttackRetargetOptionDto, 'targetActorId' | 'targetTokenId'>
): ResolveEncounterActionInputDto {
  if (command.target.kind !== 'ACTOR') throw new Error('Only a single-target action retargets.')
  if (command.sceneContext && option.targetTokenId === null)
    throw new Error('A retarget on a Scene names the creature’s token.')
  return {
    ...command,
    target: { ...command.target, actorId: option.targetActorId },
    sceneContext: command.sceneContext
      ? { ...command.sceneContext, targetTokenId: option.targetTokenId! }
      : command.sceneContext
  }
}

/**
 * Settles the sealed choice against its offer: a decline lets the action be lost, a creature turns it
 * on that creature. Either way the choice must complete exactly the selection that was made.
 */
export async function settleEncounterAttackRetarget(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  offer: EncounterAttackRetargetOfferDto
  selection: EncounterAttackRetargetSelection
}) {
  const option = chosenEncounterAttackRetarget(input.offer, input.selection)
  const selectedIndex = option ? input.offer.options.indexOf(option) + 1 : 0
  const continuation = await openEncounterAttackRetargetChoice({
    ...input,
    optionCount: input.offer.options.length
  })
  const choice = await input.runtime.resume({
    continuation,
    response: { requestId: continuation.request.requestId, value: selectedIndex }
  })
  if (choice.status !== 'COMPLETE' || choice.outputs.selectedIndex !== selectedIndex)
    throw new Error('Retarget choice did not settle its exact selection.')
  return option
}
