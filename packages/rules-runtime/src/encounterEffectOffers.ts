import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EffectOffer } from '@artificer-toolkit/schema/effects/effectOffer'

type HeldEffect = Pick<ActiveRuleEffectRecord, 'id' | 'definition'>
type EffectsByHolder = ReadonlyMap<string, readonly HeldEffect[]>

/** An offer a held effect makes an actor, with the holder it applies to (D160). */
export interface HeldEffectOffer extends EffectOffer {
  effectId: string
  offerIndex: number
  holderActorId: string
}

/** The listed form of an offer that holds right now: what the pick needs, without its condition. */
export type LiveEffectOffer = Omit<HeldEffectOffer, 'offeredTo' | 'when'>

/**
 * Every offer `actorId` is offered by the effects in `effectsByHolder`, whether or not its condition
 * holds: `SOURCE` offers go to the effect's source actor, `HOLDER` offers to its holder. The offering
 * actor need not hold the effect, so the scan covers every holder.
 */
export function effectOffersFor(input: {
  actorId: string
  effectsByHolder: EffectsByHolder
}): HeldEffectOffer[] {
  return [...input.effectsByHolder].flatMap(([holderActorId, effects]) =>
    effects.flatMap((effect) =>
      effect.definition.schemaVersion !== 2
        ? []
        : effect.definition.stateContributions.flatMap((contribution) =>
            contribution.kind !== 'MODIFIER_GRANT'
              ? []
              : (contribution.effectOffers ?? []).flatMap((offer, offerIndex) =>
                  (
                    offer.offeredTo === 'HOLDER'
                      ? holderActorId === input.actorId
                      : effect.definition.origin.kind === 'ENCOUNTER' &&
                        effect.definition.origin.sourceActorId === input.actorId
                  )
                    ? [
                        {
                          ...offer,
                          range: { ...offer.range },
                          effectId: effect.id,
                          offerIndex,
                          holderActorId
                        }
                      ]
                    : []
                )
          )
    )
  )
}

/**
 * The offers `actorId` may take now, in a stable order: those whose `when` holds on the holder
 * (`zeroHitPointActorIds` are the actors at 0 hit points).
 */
export function liveEffectOffers(input: {
  actorId: string
  effectsByHolder: EffectsByHolder
  zeroHitPointActorIds: ReadonlySet<string>
}): LiveEffectOffer[] {
  return effectOffersFor(input).flatMap(({ offeredTo: _offeredTo, when, ...choice }) =>
    when === 'HOLDER_AT_ZERO_HP' && input.zeroHitPointActorIds.has(choice.holderActorId)
      ? [choice]
      : []
  )
}

/** The live offer a pick names; a spent, ended, moved or no longer applicable offer is stale. */
export function resolveEffectOffer(
  input: Parameters<typeof liveEffectOffers>[0] & { effectId: string; offerIndex: number }
): LiveEffectOffer {
  const offer = liveEffectOffers(input).find(
    ({ effectId, offerIndex }) => effectId === input.effectId && offerIndex === input.offerIndex
  )
  if (!offer) throw new Error('The selected effect offer is stale.')
  return offer
}

/** The target policy an offer's range holds the new holder to: any single creature within `range`. */
export function effectOfferTargetPolicy(range: EffectOffer['range']): CompiledActionTargetPolicy {
  return {
    range: { id: 'effect-offer-range', rangeKind: 'DISTANCE', ...range },
    targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
    shape: null,
    pathOverrides: []
  }
}
