import { z, lazySchema } from '../zod.js'
import { MAX_ACTIVE_EFFECT_STORED_TICKS } from './activeRuleEffectLifecycle.js'

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
    /**
     * The Encounter actor whose action gave the grant (a mark's marker); null for a Character's own
     * grant, and for a hidden source for anyone but the GM.
     */
    sourceActorId: z.nullable(z.guid()),
    /** Rounds left during a Run; null once the grant waits on the Campaign clock or has no end. */
    remainingTicks: z.nullable(
      z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ACTIVE_EFFECT_STORED_TICKS))
    ),
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

/**
 * A hidden creature's concealment as only the GM sees it (D116): the Stealth total it froze and the
 * observers it is still hidden from. Players never receive it, so no player projection carries it.
 */
export const concealmentListingDtoSchema = lazySchema(() =>
  z.strictObject({
    /** The active effect the GM edits through SET_CONCEALMENT_OBSERVERS. */
    effectId: z.guid(),
    concealmentTotal: z.number().check(z.int()),
    /** The actors it is hidden from, unique and sorted; every other actor noticed it. */
    observerActorIds: z.array(z.guid())
  })
)

export type ConcealmentListingDto = z.infer<typeof concealmentListingDtoSchema>
