import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from './postgresUuid.js'

/**
 * An authored, System-neutral event that offers the GM a roll on a consequence table (ATTACK-15):
 * taking damage (only a critical hit's when `critical`), dropping from above 0 hit points to 0, or
 * failing a death saving throw by at least `byAtLeast`.
 */
export const consequenceRollTriggerDtoSchema = lazySchema(() =>
  z.discriminatedUnion('event', [
    z.strictObject({ event: z.literal('DAMAGED'), critical: z.boolean() }),
    z.strictObject({ event: z.literal('HIT_POINTS_ZERO') }),
    z.strictObject({
      event: z.literal('DEATH_SAVE_FAILED'),
      byAtLeast: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))
    })
  ])
)

/**
 * The authored triggers of one table, each event at most once. The same bound caps the triggers one
 * offer lists.
 */
export const consequenceRollTriggersDtoSchema = lazySchema(() =>
  z
    .array(consequenceRollTriggerDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(3))
    .check(
      z.superRefine((triggers, context) => {
        if (new Set(triggers.map(({ event }) => event)).size !== triggers.length)
          context.addIssue({ code: 'custom', message: 'Each trigger event is authored once.' })
      })
    )
)

/**
 * A roll the GM may make for a Character actor on an authored consequence table: one per source
 * command, listing every trigger that command met. The GM accepts (the server rolls) or declines it;
 * undoing the source command withdraws it.
 */
export const encounterConsequenceRollOfferDtoSchema = lazySchema(() =>
  z.strictObject({
    /** The command whose damage or death saving throw met the triggers; it names the offer. */
    sourceCommandId: postgresUuidSchema,
    definitionId: postgresUuidSchema,
    /** The table's name when offered, for the GM's control and the receipt. */
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    triggers: consequenceRollTriggersDtoSchema,
    occurredAt: z.iso.datetime()
  })
)

/** At most this many open offers per actor; an older one gives way to a newer. */
export const MAX_CONSEQUENCE_ROLL_OFFERS = 8

export const encounterConsequenceRollOffersDtoSchema = lazySchema(() =>
  z.array(encounterConsequenceRollOfferDtoSchema).check(z.maxLength(MAX_CONSEQUENCE_ROLL_OFFERS))
)

/** What the GM decided on an offer: the accepted roll and the row it landed on, null in a gap. */
export const consequenceRollResolutionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('decision', [
    z.strictObject({ decision: z.literal('DECLINE') }),
    z.strictObject({
      decision: z.literal('ACCEPT'),
      dieFaces: z.number().check(z.int()).check(z.gte(2)).check(z.lte(100)),
      roll: z.number().check(z.int()).check(z.positive()),
      rowId: z.nullable(postgresUuidSchema)
    })
  ])
)

export type ConsequenceRollTriggerDto = z.infer<typeof consequenceRollTriggerDtoSchema>
export type EncounterConsequenceRollOfferDto = z.infer<
  typeof encounterConsequenceRollOfferDtoSchema
>
export type ConsequenceRollResolutionDto = z.infer<typeof consequenceRollResolutionDtoSchema>
