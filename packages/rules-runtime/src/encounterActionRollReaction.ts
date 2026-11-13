import type { EncounterCastReactionOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'

import type { PendingNativeActionGraphs } from './encounterActionExecution.js'
import type { NativeTwoPhase } from './encounterActionRequest.js'
import {
  encounterReactionPin,
  openEncounterReactionChoice,
  type EncounterReactionCandidate
} from './encounterReactionChoice.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** The offer a rolled attack d20 holds for a creature that may react to it: it keeps that roll (D219). */
export type EncounterRolledReactionOffer = EncounterCastReactionOfferDto & {
  rolled: NonNullable<EncounterCastReactionOfferDto['rolled']>
}

/** The creatures that may react to an action's attack roll once its d20 is rolled (D219). */
export type EncounterActionRollReaction = {
  /**
   * The reactions of the first creature not yet heard on this roll, all of that one creature; empty
   * when nobody is left.
   */
  discover(heardReactorActorIds: readonly string[]): Promise<readonly EncounterReactionCandidate[]>
}

type RolledTestPhase = Extract<NativeTwoPhase, { phase: 'TEST' }>

/** The action held on a rolled-d20 offer, for the reactor the offer names to answer. */
export async function heldOnRollReaction(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  twoPhase: RolledTestPhase
  offer: EncounterRolledReactionOffer
  candidate: EncounterReactionCandidate
}): Promise<PendingNativeActionGraphs> {
  return {
    kind: 'PENDING',
    continuation: await openEncounterReactionChoice(input),
    d20Policy: null,
    twoPhase: input.twoPhase,
    // The d20 is the attacker's; the pending snapshot names the offer's reactor as the one who answers.
    roller: 'SOURCE',
    pause: { kind: 'CAST_REACTION', payload: input.offer }
  }
}

/**
 * Holds a rolled attack d20 for the next creature that may react to it, after the roller's own window
 * (D219). The offer keeps the roll as rolled; a used reaction runs as its holder's own action, and the
 * die that action rolls joins the roll when the action resumes. Null when nobody is left to ask.
 */
export async function holdForRollReaction(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  twoPhase: RolledTestPhase
  rollReaction: EncounterActionRollReaction
  rolled: EncounterRolledReactionOffer['rolled']
  heardReactorActorIds: readonly string[]
}): Promise<PendingNativeActionGraphs | null> {
  const candidates = await input.rollReaction.discover(input.heardReactorActorIds)
  const [candidate] = candidates
  if (!candidate) return null
  return heldOnRollReaction({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    twoPhase: input.twoPhase,
    candidate,
    offer: {
      kind: 'ATTACK_ROLL_BY_OTHER',
      reactions: candidates.map(encounterReactionPin),
      declinedReactorActorIds: [...input.heardReactorActorIds],
      rolled: input.rolled
    }
  })
}
