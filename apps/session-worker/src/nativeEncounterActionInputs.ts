import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  lockedRelationshipActionFacts,
  mergeCanonicalD20Contributors
} from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import type { encounterBasicActionAllyAdvantage } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type Relationship = Parameters<
  Parameters<typeof prepareEncounterActionMechanics>[0]['loadRelationshipFacts']
>[0]

/**
 * The relationship facts an action's d20s read: the locked ones between the two actors, and an ally's
 * Help (basic action, Q11) when the actor has one waiting.
 */
export function nativeLiveRelationshipFacts(input: {
  activeEffectsByActorId: Relationship['activeEffectsByActorId']
  allyAdvantage: ReturnType<typeof encounterBasicActionAllyAdvantage>
}) {
  return async (relationship: Relationship) =>
    mergeCanonicalD20Contributors(
      lockedRelationshipActionFacts({
        actionEffectId: relationship.actionEffectId,
        sourceActorId: relationship.sourceActorId,
        targetActorId: relationship.targetActorId,
        targets: { activeEffectsByActorId: input.activeEffectsByActorId }
      }),
      input.allyAdvantage ? [input.allyAdvantage.contributor] : []
    )
}

/** A Legendary Action is taken only in its own window, never as an ordinary action. */
export function refuseLegendaryWindowAction(prepared: Pick<Prepared, 'actor' | 'source'>) {
  if (
    prepared.source.kind === 'CREATURE' &&
    encounterLegendaryActionFeatureIds(prepared.actor).has(
      prepared.source.capability.ownerFeatureId
    )
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'LEGENDARY_WINDOW_ONLY',
      message: DOMAIN_REJECTION_MESSAGES.LEGENDARY_WINDOW_ONLY
    })
}
