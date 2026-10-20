import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EffectOffer } from '@artificer-toolkit/schema/effects/effectOffer'

type HeldEffect = Pick<ActiveRuleEffectRecord, 'id' | 'definition'>

/** One offer a held effect makes an actor that is not (only) its holder, live right now (D160). */
export interface LiveEffectOffer {
  effectId: string
  offerIndex: number
  kind: EffectOffer['kind']
  holderActorId: string
  activation: EffectOffer['activation']
  range: EffectOffer['range']
}

/**
 * The offers `actorId` may take, in a stable order: an offer is live when the effect's role matches
 * `offeredTo` (`SOURCE` is the effect's source actor, `HOLDER` its holder) and `when` holds on the
 * holder now. `effectsByHolder` is every actor's effects keyed by holder; the offering actor need not
 * hold the effect.
 */
export function liveEffectOffers(input: {
  actorId: string
  effectsByHolder: ReadonlyMap<string, readonly HeldEffect[]>
  zeroHitPointActorIds: ReadonlySet<string>
}): LiveEffectOffer[] {
  return [...input.effectsByHolder].flatMap(([holderActorId, effects]) =>
    effects.flatMap((effect) =>
      effect.definition.schemaVersion !== 2
        ? []
        : effect.definition.stateContributions.flatMap((contribution) =>
            contribution.kind !== 'MODIFIER_GRANT'
              ? []
              : (contribution.effectOffers ?? []).flatMap(
                  ({ kind, offeredTo, when, activation, range }, offerIndex) =>
                    (offeredTo === 'HOLDER'
                      ? holderActorId === input.actorId
                      : effect.definition.origin.kind === 'ENCOUNTER' &&
                        effect.definition.origin.sourceActorId === input.actorId) &&
                    when === 'HOLDER_AT_ZERO_HP' &&
                    input.zeroHitPointActorIds.has(holderActorId)
                      ? [
                          {
                            effectId: effect.id,
                            offerIndex,
                            kind,
                            holderActorId,
                            activation,
                            range: { ...range }
                          }
                        ]
                      : []
                )
          )
    )
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
