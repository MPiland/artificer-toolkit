import { z, lazySchema } from '../zod.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { postgresUuidSchema } from './postgresUuid.js'

/** The most turns an authored Encounter active effect lasts: 24 hours of 6-second rounds (D156). */
export const MAX_ACTIVE_EFFECT_TURNS = 14_400

/** The effects beside an action's own that it creates on one target: a failed save's band of up to four conditions holds one effect each. */
export const MAX_ACTION_RIDERS = 3
/** A grant made on its anchor's own turn is stored one tick longer, so storage allows one more turn. */
export const MAX_ACTIVE_EFFECT_STORED_TICKS = MAX_ACTIVE_EFFECT_TURNS + 1
/** The uses an authored effect counts before it ends, at most 255 (Mirror Image duplicates). */
export const activeEffectUsesSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.gte(1)).check(z.lte(255))
)

/**
 * An effect whose fixed bonus and penalty grants shrink by `step` at each matching rest and which
 * ends once they reach 0 (Raise Dead's -4 that fades by one per long rest).
 */
export const activeEffectRestStepDownSchema = lazySchema(() =>
  z.strictObject({
    trigger: z.literal('LONG_REST'),
    step: z.number().check(z.int()).check(z.gte(1)).check(z.lte(255))
  })
)

/** The repeat saves a threshold-counted effect has made so far; the thresholds live in its definition. */
export const activeEffectSaveTallySchema = lazySchema(() =>
  z.strictObject({
    successes: z.number().check(z.int()).check(z.gte(0)).check(z.lte(255)),
    failures: z.number().check(z.int()).check(z.gte(0)).check(z.lte(255))
  })
)

/** A repeat save counted to thresholds: the successes that end the effect and the failures that settle it. */
export const activeEffectSaveThresholdsSchema = lazySchema(() =>
  z.strictObject({
    successesToEnd: z.number().check(z.int()).check(z.gte(1)).check(z.lte(255)),
    failuresToResolve: z.number().check(z.int()).check(z.gte(1)).check(z.lte(255)),
    /** A success zeroes the failure count and a failure the success count. */
    consecutive: z.boolean()
  })
)

/** Mutable current lifecycle state. It never repeats immutable recurrence configuration. */
export const activeRuleEffectLifecycleDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    remainingTicks: z.nullable(
      z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ACTIVE_EFFECT_STORED_TICKS))
    ),
    /**
     * Only on an effect authored with `uses`: the uses left before it ends. Something else (a
     * modifier domain) spends them; the immutable definition holds the initial count.
     */
    remainingUses: z.optional(activeEffectUsesSchema),
    /**
     * Only on an effect authored with `restStepDown`: the rests left before its grants reach 0 and it
     * ends. Each matching rest lowers it by one and steps the definition's grants down by `step`.
     */
    restStepsRemaining: z.optional(activeEffectUsesSchema),
    /**
     * Only on an effect authored with repeat-save `THRESHOLDS`: the successes and failures its
     * turn saves have counted, advanced in the same CAS as `remainingTicks`. The thresholds live in
     * the definition's `recurrence.saveThresholds`.
     */
    saveTally: z.optional(activeEffectSaveTallySchema),
    /**
     * Set once a grant is carried out of its Run (D99): it ends when the Campaign clock reaches this
     * absolute minute, or, `null` without a Campaign clock, when the GM ends it.
     */
    expiresAtCampaignMinute: z.optional(
      z.nullable(z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER)))
    ),
    /**
     * Set once a Concentration grant is carried out of its Run (D99, SPELLS-5.7): the Character that
     * cast it, `null` when a Creature did. Another Concentration of that Character ends the grant.
     */
    concentrationCasterCharacterId: z.optional(z.nullable(postgresUuidSchema)),
    /**
     * Only on a `CREATURE_FORM` effect carried out of its Run (D99, SPELLS-28.T4b): the form's
     * Creature and hit points, which the next Run's actor for the Character resumes.
     */
    carriedCreatureForm: z.optional(
      z.strictObject({
        sourceId: postgresUuidSchema,
        sourceRevision: z.number().check(z.int()).check(z.positive()),
        /** JSON text, as `definitionJson` is, so the lifecycle stays a flat Convex validator. */
        snapshotJson: z.string(),
        currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
        maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
        tempHitPoints: z.number().check(z.int()).check(z.nonnegative())
      })
    ),
    /**
     * Only on a `LOCATION_CONCEALMENT` effect: the observers its holder's location is unknown to,
     * sorted and unique. Search, the GM and a token move shrink it; the definition stays immutable.
     */
    concealedFromActorIds: z.optional(
      z
        .array(postgresUuidSchema)
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        .check(
          z.superRefine((ids, ctx) => {
            if (ids.slice(1).some((id, index) => ids[index]! >= id))
              ctx.addIssue({
                code: 'custom',
                message: 'Concealed observers must be unique and sorted.'
              })
          })
        )
    )
  })
)

export type ActiveEffectSaveThresholds = z.infer<typeof activeEffectSaveThresholdsSchema>
export type ActiveEffectSaveTally = z.infer<typeof activeEffectSaveTallySchema>
export type ActiveRuleEffectLifecycleDto = z.infer<typeof activeRuleEffectLifecycleDtoSchema>
