import { z, lazySchema } from '../zod.js'
import { activationCodeSchema, lengthUnitCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

/** The most effect offers one held effect carries. */
export const MAX_EFFECT_OFFERS = 4

/** The most paths one repeat offer re-runs. */
const MAX_REPEAT_OFFER_PATHS = 8

export const effectOfferRangeDtoSchema = lazySchema(() =>
  z.strictObject({
    amount: z.number().check(z.int()).check(z.gte(1)),
    unit: lengthUnitCodeSchema
  })
)

export interface MoveHeldEffectOffer {
  kind: 'MOVE_HELD_EFFECT'
  offeredTo: 'SOURCE' | 'HOLDER'
  when: 'HOLDER_AT_ZERO_HP'
  activation: z.infer<typeof activationCodeSchema>
  range: z.infer<typeof effectOfferRangeDtoSchema>
}

/**
 * Who a repeat is made against: the creature that holds the offering effect (`HOLDER`, a mark the
 * caster re-attacks) or whoever the re-run Effect's own invocation targets (`INVOCATION`, an attack
 * the caster makes with an effect they hold themselves).
 */
export const repeatOfferTargetSchema = lazySchema(() => z.enum(['HOLDER', 'INVOCATION']))
export type RepeatOfferTarget = 'HOLDER' | 'INVOCATION'

/**
 * Where a repeat's range and reach are measured from: the actor that takes it (`ACTOR`), or the
 * creature the carrier conjured (`CONJURED`, a summoned weapon the caster attacks with).
 */
export const repeatOfferOriginSchema = lazySchema(() => z.enum(['ACTOR', 'CONJURED']))
export type RepeatOfferOrigin = 'ACTOR' | 'CONJURED'

/**
 * What a repeat's first use costs in the turn its cast was made (D190a): `FREE_ONCE` spends no
 * action economy for that one use, by the caster.
 */
export const repeatOfferCastTurnUseSchema = lazySchema(() => z.literal('FREE_ONCE'))
export type RepeatOfferCastTurnUse = 'FREE_ONCE'

/**
 * As authored: what the offer re-runs, named by id. `pathIds` re-run those paths of the Effect that
 * carries the offer; `effectId` re-runs every path of a sibling Effect of the same subject, with its
 * invocation (an attack the carrier's own invocation is not). Exactly one is set.
 */
export interface RepeatSourcePathOffer {
  kind: 'REPEAT_SOURCE_PATH'
  offeredTo: 'SOURCE'
  activation: z.infer<typeof activationCodeSchema>
  pathIds?: string[]
  effectId?: string
  /** Absent means `HOLDER`. */
  target?: RepeatOfferTarget
  /** Absent means `ACTOR`. */
  origin?: RepeatOfferOrigin
  /** Absent means every use is charged to `activation`. */
  castTurnUse?: RepeatOfferCastTurnUse
}

export type EffectOffer = MoveHeldEffectOffer | RepeatSourcePathOffer

export const moveHeldEffectOfferSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('MOVE_HELD_EFFECT'),
    offeredTo: z.enum(['SOURCE', 'HOLDER']),
    when: z.literal('HOLDER_AT_ZERO_HP'),
    activation: activationCodeSchema,
    range: effectOfferRangeDtoSchema
  })
)

const repeatSourcePathOfferSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('REPEAT_SOURCE_PATH'),
      offeredTo: z.literal('SOURCE'),
      activation: activationCodeSchema,
      pathIds: z.optional(
        z
          .array(authoredIdentifierSchema)
          .check(z.minLength(1))
          .check(z.maxLength(MAX_REPEAT_OFFER_PATHS))
      ),
      effectId: z.optional(authoredIdentifierSchema),
      target: z.optional(repeatOfferTargetSchema),
      origin: z.optional(repeatOfferOriginSchema),
      castTurnUse: z.optional(repeatOfferCastTurnUseSchema)
    })
    .check(
      z.refine(
        ({ pathIds, effectId }) => (pathIds === undefined) !== (effectId === undefined),
        'A repeat offer names the paths it re-runs or a sibling Effect, not both.'
      )
    )
)

/** An offer is charged to an action, a bonus action or a similar allowance, never a Reaction or a free activation. */
export function checkEffectOfferActivations(offers: readonly { activation: string }[]): boolean {
  return offers.every((offer) => offer.activation !== 'REACTION' && offer.activation !== 'FREE')
}

export const EFFECT_OFFER_ACTIVATION_MESSAGE =
  'An effect offer is charged to an action, a bonus action or a similar allowance, never a Reaction or a free activation.'

/**
 * One choice a held effect offers beside its holder's own turns (D160). `MOVE_HELD_EFFECT` lets
 * `offeredTo` (the effect's source, or its holder) move the effect, with its remaining duration and
 * Concentration, to another creature within `range`, charged to `activation`, once `when` holds for
 * the holder. `REPEAT_SOURCE_PATH` (D166) lets the effect's source re-run the named paths of the
 * Effect that made it against the holder, charged to `activation`; the stored form carries the
 * paths as a frozen Effect (`storedEffectOffer.ts`).
 */
export const effectOffersDtoSchema: z.ZodMiniType<EffectOffer[]> = lazySchema(() =>
  z
    .array(z.discriminatedUnion('kind', [moveHeldEffectOfferSchema, repeatSourcePathOfferSchema]))
    .check(z.minLength(1))
    .check(z.maxLength(MAX_EFFECT_OFFERS))
    .check(z.refine(checkEffectOfferActivations, EFFECT_OFFER_ACTIVATION_MESSAGE))
)
