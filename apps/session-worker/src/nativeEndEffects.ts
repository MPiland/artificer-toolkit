import { TARGET_NOTHING_TO_END_WARNING } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterBasicActionDefinitionId,
  isEncounterBasicActionId
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  actionUsedOnHolderEndedEffects,
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
export function planEndEffects(
  gameSystemId: string,
  outcomes: readonly {
    kind: string
    endEffects?: Parameters<typeof offerEndEffects>[0]['endEffects']
  }[],
  held: readonly ActiveRuleEffectRecord[],
  target: { kind: string; chosenEffectId?: string },
  castLevel: number | null
) {
  const [endEffects] = outcomes.flatMap((outcome) =>
    outcome.kind === 'EFFECT' && outcome.endEffects ? [outcome.endEffects] : []
  )
  const offer = offerEndEffects({
    endEffects,
    held,
    chosenEffectId: target.chosenEffectId,
    castLevel
  })
  if (offer.pick?.kind === 'UNCHOSEN')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Choose which effect on the target this ends.'
    })
  const warnings: EncounterRuleWarningDto[] =
    endEffects && offer.candidates.length === 0 ? [TARGET_NOTHING_TO_END_WARNING] : []
  return { gameSystemId, endEffects, offer, warnings }
}

/**
 * The effects the committed action ends: what a basic action used on the holder ends (rousing a
 * sleeper), else what the action's own end-effects outcome selects when the System says its
 * execution ends effects.
 */
export function endedByAction(
  plan: ReturnType<typeof planEndEffects>,
  command: { actorId: string; actionId: string },
  execution: CommittedExecutionTrace,
  held: readonly ActiveRuleEffectRecord[],
  { actor, target }: { actor: { id: string }; target: { id: string } }
) {
  if (isEncounterBasicActionId(command.actorId, command.actionId))
    return actionUsedOnHolderEndedEffects({
      holderActorId: target.id,
      held,
      usedByActorId: actor.id,
      basicActionDefinitionId: encounterBasicActionDefinitionId(command.actionId)
    })
  const { endEffects, offer } = plan
  return endEffects &&
    executionOutcomeCapabilityRegistry.require(plan.gameSystemId).endsEffects(execution)
    ? selectedEndedEffects({
        holderActorId: target.id,
        held,
        selectors: offer.selectors,
        castLevel: offer.castLevel,
        scope: endEffects.scope,
        chosenEffectId: offer.pick?.kind === 'CHOSEN' ? offer.pick.effectId : undefined
      })
    : null
}
