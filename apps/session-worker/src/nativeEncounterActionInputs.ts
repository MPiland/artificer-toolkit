import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { encounterBasicActionRestrictionsHold } from '@artificer-toolkit/rules-runtime/encounterBasicActionRestrictions'
import { encounterHolderState } from '@artificer-toolkit/rules-runtime/encounterHolderDefense'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type Relationship = Parameters<
  Parameters<typeof prepareEncounterActionMechanics>[0]['loadRelationshipFacts']
>[0]

/** The relationship facts an action's d20s read: the locked ones between the two actors. */
export function nativeLiveRelationshipFacts(input: {
  activeEffectsByActorId: Relationship['activeEffectsByActorId']
}) {
  return async (relationship: Relationship) =>
    lockedRelationshipActionFacts({
      actionEffectId: relationship.actionEffectId,
      sourceActorId: relationship.sourceActorId,
      targetActorId: relationship.targetActorId,
      targets: { activeEffectsByActorId: input.activeEffectsByActorId }
    })
}

/**
 * Every action path admits an action through here: a Legendary Action is taken only in its own
 * window, and a reaction only when its trigger happens, never as an ordinary action.
 */
export function refuseActionOutsideItsWindow(prepared: Pick<Prepared, 'actor' | 'source'>) {
  const { source } = prepared
  if (
    source.kind === 'CREATURE' &&
    encounterLegendaryActionFeatureIds(prepared.actor).has(source.capability.ownerFeatureId)
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'LEGENDARY_WINDOW_ONLY',
      message: DOMAIN_REJECTION_MESSAGES.LEGENDARY_WINDOW_ONLY
    })
  const { mechanicFacts } =
    source.kind === 'CHARACTER_ACTION' ? source.candidate : source.capability
  if (mechanicFacts.invocation.reactionTrigger)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'REACTION_TRIGGER_ONLY',
      message: DOMAIN_REJECTION_MESSAGES.REACTION_TRIGGER_ONLY
    })
}

/** An authored basic action is taken only by an actor that meets its facet restrictions. */
export async function refuseUnmetBasicActionRestrictions(
  prepared: Pick<Prepared, 'source'>,
  holder: Parameters<typeof encounterHolderState>[0]
) {
  if (
    prepared.source.kind === 'BASIC_ACTION' &&
    prepared.source.capability.restrictions &&
    !encounterBasicActionRestrictionsHold(
      prepared.source.capability.restrictions,
      await encounterHolderState(holder)
    )
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'SOURCE_REQUIREMENTS_NOT_MET',
      message: DOMAIN_REJECTION_MESSAGES.SOURCE_REQUIREMENTS_NOT_MET
    })
}

/** A spatially interpreted outcome (forced movement, terrain) has no live settlement yet. */
export function refuseSpatialInterpretation(
  prepared: Pick<Prepared, 'adapter'>,
  input: {
    execution: Parameters<NonNullable<Prepared['adapter']['interpretSpatial']>>[0]['execution']
    occurrenceId: string
    published: Parameters<NonNullable<Prepared['adapter']['interpretSpatial']>>[0]['published']
    targetActorId: string
  }
) {
  if (prepared.adapter.interpretSpatial?.(input).length)
    throw new Error('Spatially interpreted actions are not available yet.')
}
