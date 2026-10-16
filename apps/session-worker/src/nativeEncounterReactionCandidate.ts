import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { ASSISTED_REACTION_CHOICE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDecision'
import type { EncounterReactionCandidate } from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { createReactionChoiceDefinition } from '@artificer-toolkit/rules-runtime/reactionChoiceDefinition'

import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import type { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>

/** A reaction its holder could use now, prepared against its reactor's own facts. */
export type NativeReaction<Candidate> = {
  candidate: Candidate
  prepared: Prepared
  economy: NonNullable<Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['economy']>
}

/** The reaction a Character holds and can afford now, as the offer will seal it. */
export function nativeReactionCandidate<Trigger extends string>(input: {
  trigger: Trigger
  reactorActorId: string
  source: Extract<Prepared['source'], { kind: 'CHARACTER_ACTION' }>
  actionId: string
  consumption: Pick<
    NativeReaction<unknown>['economy']['consumption'],
    'definitionId' | 'beforeUsed' | 'maximum'
  >
  gameSystemId: string
}): EncounterReactionCandidate<Trigger> {
  const { source, consumption } = input
  return {
    trigger: input.trigger,
    reactorActorId: input.reactorActorId,
    characterId: source.characterId,
    characterStreamVersion: source.characterStreamVersion,
    actionId: input.actionId,
    effectId: source.candidate.effectId,
    allowance: {
      definitionId: consumption.definitionId,
      beforeUsed: consumption.beforeUsed,
      maximum: consumption.maximum
    },
    choiceGraph: createReactionChoiceDefinition({
      definitionId: ASSISTED_REACTION_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    })
  }
}

/** The user-safe refusal of a reaction this System cannot resolve inline. */
export const unsupportedReaction = (message: string) =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'REACTION_UNSUPPORTED',
    message
  })
