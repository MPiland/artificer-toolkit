import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { z, lazySchema } from '../zod.js'
import { activationCodeSchema } from '../shared/enums.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { effectDtoSchema } from './effect.js'
import {
  checkEffectOfferActivations,
  EFFECT_OFFER_ACTIVATION_MESSAGE,
  MAX_EFFECT_OFFERS,
  moveHeldEffectOfferSchema,
  repeatOfferCastTurnUseSchema,
  repeatOfferOriginSchema,
  repeatOfferTargetSchema,
  type MoveHeldEffectOffer,
  type RepeatOfferCastTurnUse,
  type RepeatOfferOrigin,
  type RepeatOfferTarget
} from './effectOffer.js'

/**
 * A repeat offer once the Effect that made it has resolved its paths (D166): the paths it re-runs are
 * the authored Effect itself, a subset of the cast's. A held effect stores it with `castLevel` set
 * and its saving throw frozen at the DC the cast settled, so the repeat never reads the caster's
 * current stats or slots.
 */
export interface CompiledRepeatSourcePathOffer {
  kind: 'REPEAT_SOURCE_PATH'
  offeredTo: 'SOURCE'
  activation: z.infer<typeof activationCodeSchema>
  effect: EffectAuthored
  castLevel?: number
  /** The holder's attack bonus the cast froze for an attack repeat; its roll mode is read live. */
  attackBonus?: number
  /**
   * The dice expression each damage outcome of `effect` resolved to at the cast, by outcome id, so a
   * repeat's ability bonus is the one its caster had; absent when the cast resolved none.
   */
  damageExpressions?: Readonly<Record<string, string>>
  /** Absent means `HOLDER`. */
  target?: RepeatOfferTarget
  /** Absent means `ACTOR`. */
  origin?: RepeatOfferOrigin
  /** Absent means every use is charged to `activation`. */
  castTurnUse?: RepeatOfferCastTurnUse
  /** The Run's `turnSequence` the cast was made in, which a held `FREE_ONCE` offer freezes. */
  castTurnSequence?: number
}

/** The offers a compiled effect action plans, before the cast freezes them onto a held effect. */
export type CompiledEffectOffer = MoveHeldEffectOffer | CompiledRepeatSourcePathOffer

/** Named so the schemas embedding a repeat offer stay within the declaration size limit (TS7056). */
const embeddedEffectSchema: z.ZodMiniType<EffectAuthored> = effectDtoSchema

const compiledRepeatSourcePathOfferSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('REPEAT_SOURCE_PATH'),
    offeredTo: z.literal('SOURCE'),
    activation: activationCodeSchema,
    effect: embeddedEffectSchema,
    castLevel: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(9))),
    attackBonus: z.optional(z.number().check(z.int())),
    damageExpressions: z.optional(
      z
        .record(
          authoredIdentifierSchema,
          z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
        )
        .check(z.refine((value) => Object.keys(value).length <= 10, 'Too many damage outcomes.'))
    ),
    target: z.optional(repeatOfferTargetSchema),
    origin: z.optional(repeatOfferOriginSchema),
    castTurnUse: z.optional(repeatOfferCastTurnUseSchema),
    castTurnSequence: z.optional(z.number().check(z.int()).check(z.nonnegative()))
  })
)

const storedRepeatSourcePathOfferSchema = lazySchema(() =>
  compiledRepeatSourcePathOfferSchema
    .check(
      z.refine(
        ({ effect: { invocation } }) =>
          !('savingThrow' in invocation) || invocation.savingThrow.dcMethod === 'FIXED_DC',
        'A stored repeat offer freezes its saving throw at the DC the cast settled.'
      )
    )
    .check(
      z.refine(
        ({ castTurnUse, castTurnSequence }) =>
          (castTurnUse === undefined) === (castTurnSequence === undefined),
        'A stored FREE_ONCE repeat offer freezes the turn its cast was made in, and only it does.'
      )
    )
)

export const compiledEffectOffersSchema: z.ZodMiniType<CompiledEffectOffer[]> = lazySchema(() =>
  z
    .array(
      z.discriminatedUnion('kind', [moveHeldEffectOfferSchema, compiledRepeatSourcePathOfferSchema])
    )
    .check(z.minLength(1))
    .check(z.maxLength(MAX_EFFECT_OFFERS))
    .check(z.refine(checkEffectOfferActivations, EFFECT_OFFER_ACTIVATION_MESSAGE))
)

/** The offers a held effect stores: a repeat offer carries its frozen Effect and cast level. */
export const storedEffectOffersSchema: z.ZodMiniType<CompiledEffectOffer[]> = lazySchema(() =>
  z
    .array(
      z.discriminatedUnion('kind', [moveHeldEffectOfferSchema, storedRepeatSourcePathOfferSchema])
    )
    .check(z.minLength(1))
    .check(z.maxLength(MAX_EFFECT_OFFERS))
    .check(z.refine(checkEffectOfferActivations, EFFECT_OFFER_ACTIVATION_MESSAGE))
)

export type StoredEffectOffer = CompiledEffectOffer
