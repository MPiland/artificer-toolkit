import { TARGET_NOTHING_TO_END_WARNING } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  offerEndEffects,
  selectedEndedEffects
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import type { CommittedExecutionTrace } from '@artificer-toolkit/rules-runtime/executionOutcomeCapability'
import { executionOutcomeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'

import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

/**
 * An end-effects action's legal list is the target's own held effects it could end: one match is
 * picked for the caster, several need the caster's pick (a cast without one is rejected), none is
 * an overridable warning.
 */
export function planEndEffects(input: {
  outcomes: readonly {
    kind: string
    endEffects?: { scope: 'ALL' | 'ONE_CHOSEN'; conditionIds: readonly string[] }
  }[]
  held: readonly ActiveRuleEffectRecord[]
  chosenEffectId: string | undefined
}) {
  const [endEffects] = input.outcomes.flatMap((outcome) =>
    outcome.kind === 'EFFECT' && outcome.endEffects ? [outcome.endEffects] : []
  )
  const offer = offerEndEffects({
    endEffects,
    held: input.held,
    chosenEffectId: input.chosenEffectId
  })
  if (offer.pick?.kind === 'UNCHOSEN')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Choose which effect on the target this ends.'
    })
  const warnings: EncounterRuleWarningDto[] =
    endEffects && offer.candidates.length === 0 ? [TARGET_NOTHING_TO_END_WARNING] : []
  return { endEffects, offer, warnings }
}

/** The effects the committed action ends, when the System says its execution ends effects. */
export function committedEndEffects(
  plan: ReturnType<typeof planEndEffects>,
  input: {
    gameSystemId: string
    execution: CommittedExecutionTrace
    holderActorId: string
    held: readonly ActiveRuleEffectRecord[]
  }
) {
  const { endEffects, offer } = plan
  return endEffects &&
    executionOutcomeCapabilityRegistry.require(input.gameSystemId).endsEffects(input.execution)
    ? selectedEndedEffects({
        holderActorId: input.holderActorId,
        held: input.held,
        selectors: offer.selectors,
        scope: endEffects.scope,
        chosenEffectId: offer.pick?.kind === 'CHOSEN' ? offer.pick.effectId : undefined
      })
    : null
}
