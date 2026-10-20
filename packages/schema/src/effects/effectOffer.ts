import { z, lazySchema } from '../zod.js'
import { activationCodeSchema, lengthUnitCodeSchema } from '../shared/enums.js'

/** The most effect offers one held effect carries. */
const MAX_EFFECT_OFFERS = 4

/** The kinds of choice a held effect offers; a further kind joins here. */
export const effectOfferKindSchema = lazySchema(() => z.literal('MOVE_HELD_EFFECT'))

/** How far from the holder the offer's pick may reach. */
export const effectOfferRangeDtoSchema = lazySchema(() =>
  z.strictObject({
    amount: z.number().check(z.int()).check(z.gte(1)),
    unit: lengthUnitCodeSchema
  })
)

export interface EffectOffer {
  kind: z.infer<typeof effectOfferKindSchema>
  offeredTo: 'SOURCE' | 'HOLDER'
  when: 'HOLDER_AT_ZERO_HP'
  activation: z.infer<typeof activationCodeSchema>
  range: z.infer<typeof effectOfferRangeDtoSchema>
}

/**
 * One choice a held effect offers beside its holder's own turns (D160). `MOVE_HELD_EFFECT` lets
 * `offeredTo` (the effect's source, or its holder) move the effect, with its remaining duration and
 * Concentration, to another creature within `range`, charged to `activation`, once `when` holds for
 * the holder. A further `kind` joins this envelope without changing how an offer is listed or picked.
 * The offer names no catalogue ids, so it is the same shape authored and frozen onto a stored effect.
 */
export const effectOffersDtoSchema: z.ZodMiniType<EffectOffer[]> = lazySchema(() =>
  z
    .array(
      z
        .strictObject({
          kind: effectOfferKindSchema,
          offeredTo: z.enum(['SOURCE', 'HOLDER']),
          when: z.literal('HOLDER_AT_ZERO_HP'),
          activation: activationCodeSchema,
          range: effectOfferRangeDtoSchema
        })
        .check(
          z.refine(
            (offer) => offer.activation !== 'REACTION' && offer.activation !== 'FREE',
            'An effect offer is charged to an action, a bonus action or a similar allowance, never a Reaction or a free activation.'
          )
        )
    )
    .check(z.minLength(1))
    .check(z.maxLength(MAX_EFFECT_OFFERS))
)
