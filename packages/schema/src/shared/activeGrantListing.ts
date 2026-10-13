import { z, lazySchema } from '../zod.js'

/**
 * An active grant as a viewer lists it on a token, the turn tracker or the Sheet (D99): its source
 * label and what is left of it. A hidden source's label is `null` for anyone but the GM.
 */
export const activeGrantListingDtoSchema = lazySchema(() =>
  z.strictObject({
    /** The active effect the GM ends by hand. */
    effectId: z.guid(),
    label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))),
    sourceHidden: z.boolean(),
    /** Rounds left during a Run; null once the grant waits on the Campaign clock or has no end. */
    remainingTicks: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(10_000))),
    /** The absolute Campaign-clock minute a carried-over grant ends; null for any other grant. */
    expiresAtCampaignMinute: z.nullable(
      z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER))
    ),
    /** What the grant does for its holder, derived from its modifiers and never authored. */
    polarity: z.enum(['BENEFICIAL', 'HARMFUL', 'NEUTRAL'])
  })
)

export type ActiveGrantListingDto = z.infer<typeof activeGrantListingDtoSchema>

/**
 * The Concentration a caster maintains, named by a grant that depends on it (SPELLS-5.11). The label
 * is null for a hidden source or when nothing depends on it; the caster ends it with END_CONCENTRATION.
 */
export const concentrationListingDtoSchema = lazySchema(() =>
  z.strictObject({
    label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))),
    sourceHidden: z.boolean()
  })
)

export type ConcentrationListingDto = z.infer<typeof concentrationListingDtoSchema>
