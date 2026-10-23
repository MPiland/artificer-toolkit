import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { MoveHeldEffectOffer } from '@artificer-toolkit/schema/effects/effectOffer'
import type { CompiledRepeatSourcePathOffer } from '@artificer-toolkit/schema/effects/storedEffectOffer'

type HeldEffect = Pick<ActiveRuleEffectRecord, 'id' | 'definition'> &
  Partial<Pick<ActiveRuleEffectRecord, 'maintainedEffectStateId'>>
type EffectsByHolder = ReadonlyMap<string, readonly HeldEffect[]>

/** Where a held offer lives: the effect that carries it, its place in the effect, and its holder. */
interface HeldOfferPlace {
  effectId: string
  offerIndex: number
  holderActorId: string
}

/** An offer a held effect makes an actor, with the holder it applies to (D160, D166). */
export type HeldEffectOffer = (MoveHeldEffectOffer | CompiledRepeatSourcePathOffer) & HeldOfferPlace

/**
 * The listed form of an offer that holds right now: what the pick needs, without its condition. A
 * repeat offer keeps its frozen Effect, which the pick runs.
 */
export type LiveEffectOffer =
  | (Omit<MoveHeldEffectOffer, 'offeredTo' | 'when'> & HeldOfferPlace)
  | (Omit<CompiledRepeatSourcePathOffer, 'offeredTo'> & HeldOfferPlace)

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
      effect.definition.stateContributions.flatMap((contribution) =>
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
                      ...(offer.kind === 'MOVE_HELD_EFFECT' && { range: { ...offer.range } }),
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
 * The offers `actorId` may take now, in a stable order: a move offer whose `when` holds on the holder
 * (`zeroHitPointActorIds` are the actors at 0 hit points), and a repeat offer for as long as its
 * effect is held.
 */
export function liveEffectOffers(input: {
  actorId: string
  effectsByHolder: EffectsByHolder
  zeroHitPointActorIds: ReadonlySet<string>
}): LiveEffectOffer[] {
  return effectOffersFor(input).flatMap((held): LiveEffectOffer[] => {
    const { offeredTo: _offeredTo, ...offer } = held
    if (offer.kind === 'REPEAT_SOURCE_PATH') return [offer]
    const { when, ...choice } = offer
    return when === 'HOLDER_AT_ZERO_HP' && input.zeroHitPointActorIds.has(choice.holderActorId)
      ? [choice]
      : []
  })
}

/** The live offer of `kind` a pick names; a spent, ended, moved or no longer applicable offer is stale. */
export function resolveEffectOffer<TKind extends LiveEffectOffer['kind']>(
  input: Parameters<typeof liveEffectOffers>[0] & {
    effectId: string
    offerIndex: number
    kind: TKind
  }
): Extract<LiveEffectOffer, { kind: TKind }> {
  const offer = liveEffectOffers(input).find(
    (live): live is Extract<LiveEffectOffer, { kind: TKind }> =>
      live.effectId === input.effectId &&
      live.offerIndex === input.offerIndex &&
      live.kind === input.kind
  )
  if (!offer) throw new Error('The selected effect offer is stale.')
  return offer
}

/** The target policy an offer's range holds the new holder to: any single creature within `range`. */
export function effectOfferTargetPolicy(
  range: MoveHeldEffectOffer['range']
): CompiledActionTargetPolicy {
  return {
    range: { id: 'effect-offer-range', rangeKind: 'DISTANCE', ...range },
    targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
    shape: null,
    pathOverrides: []
  }
}
