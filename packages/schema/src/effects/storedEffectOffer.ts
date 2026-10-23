import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { z, lazySchema } from '../zod.js'
import { activationCodeSchema } from '../shared/enums.js'
import { effectDtoSchema } from './effect.js'
import {
  checkEffectOfferActivations,
  EFFECT_OFFER_ACTIVATION_MESSAGE,
  MAX_EFFECT_OFFERS,
  moveHeldEffectOfferSchema,
  repeatOfferTargetSchema,
  type MoveHeldEffectOffer,
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
  target?: RepeatOfferTarget
  effect: EffectAuthored
  castLevel?: number
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
    target: z.optional(repeatOfferTargetSchema),
    effect: embeddedEffectSchema,
    castLevel: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(9)))
  })
)

const storedRepeatSourcePathOfferSchema = lazySchema(() =>
  compiledRepeatSourcePathOfferSchema.check(
    z.refine(
      ({ effect: { invocation } }) =>
        !('savingThrow' in invocation) || invocation.savingThrow.dcMethod === 'FIXED_DC',
      'A stored repeat offer freezes its saving throw at the DC the cast settled.'
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
