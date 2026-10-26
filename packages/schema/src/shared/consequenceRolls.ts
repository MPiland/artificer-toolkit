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

/** The largest die a consequence table rolls. */
export const MAX_CONSEQUENCE_ROLL_DIE_FACES = 100

const consequenceRollTextSchema = (maximum: number) =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(maximum))

/**
 * One authored row of a consequence table: the rolls it covers, what it is called, what it does and
 * the recovery the table names. Applying the effect and every recovery are the GM's judgment
 * (D187a), so `effect` and `healing` are guidance text only.
 */
export const consequenceRollRowDtoSchema = lazySchema(() =>
  z
    .strictObject({
      id: postgresUuidSchema,
      minimum: z.number().check(z.int()).check(z.positive()),
      maximum: z.number().check(z.int()).check(z.positive()),
      label: consequenceRollTextSchema(160),
      effect: consequenceRollTextSchema(1000),
      healing: consequenceRollTextSchema(1000)
    })
    .check(
      z.superRefine((row, context) => {
        if (row.minimum > row.maximum)
          context.addIssue({
            code: 'custom',
            path: ['maximum'],
            message: 'A row maximum must not precede its minimum.'
          })
      })
    )
)

/**
 * An authored consequence table: a die and its ordered, non-overlapping rows within the die's
 * faces. Rolls between rows land on no row.
 */
export const consequenceRollTableDtoSchema = lazySchema(() =>
  z
    .strictObject({
      dieFaces: z
        .number()
        .check(z.int())
        .check(z.gte(2))
        .check(z.lte(MAX_CONSEQUENCE_ROLL_DIE_FACES)),
      rows: z
        .array(consequenceRollRowDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_CONSEQUENCE_ROLL_DIE_FACES))
    })
    .check(
      z.superRefine((table, context) => {
        let previousMaximum = 0
        const ids = new Set<string>()
        for (const [index, row] of table.rows.entries()) {
          if (row.minimum <= previousMaximum || row.maximum > table.dieFaces)
            context.addIssue({
              code: 'custom',
              path: ['rows', index, 'minimum'],
              message: 'Rows must be ordered, non-overlapping and within the die.'
            })
          if (ids.has(row.id))
            context.addIssue({
              code: 'custom',
              path: ['rows', index, 'id'],
              message: 'Row identities must be unique.'
            })
          ids.add(row.id)
          previousMaximum = row.maximum
        }
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
      dieFaces: z
        .number()
        .check(z.int())
        .check(z.gte(2))
        .check(z.lte(MAX_CONSEQUENCE_ROLL_DIE_FACES)),
      roll: z.number().check(z.int()).check(z.positive()),
      rowId: z.nullable(postgresUuidSchema)
    })
  ])
)

/** At most this many recorded consequences per Character. */
export const MAX_CHARACTER_CONSEQUENCES = 20

/**
 * A row the GM accepted for a Character, such as a lingering injury. It keeps the row's text as
 * rolled, so the Sheet still shows it after the table changes, and lasts until the GM removes it.
 */
export const characterConsequenceDtoSchema = lazySchema(() =>
  z.strictObject({
    /** The resolve command that recorded it. */
    id: postgresUuidSchema,
    definitionId: postgresUuidSchema,
    rowId: postgresUuidSchema,
    tableLabel: consequenceRollTextSchema(160),
    label: consequenceRollTextSchema(160),
    effect: consequenceRollTextSchema(1000),
    healing: consequenceRollTextSchema(1000),
    recordedAt: z.iso.datetime()
  })
)

export const characterConsequencesDtoSchema = lazySchema(() =>
  z.array(characterConsequenceDtoSchema).check(z.maxLength(MAX_CHARACTER_CONSEQUENCES))
)

export type ConsequenceRollTriggerDto = z.infer<typeof consequenceRollTriggerDtoSchema>
export type EncounterConsequenceRollOfferDto = z.infer<
  typeof encounterConsequenceRollOfferDtoSchema
>
export type ConsequenceRollResolutionDto = z.infer<typeof consequenceRollResolutionDtoSchema>
export type ConsequenceRollTableDto = z.infer<typeof consequenceRollTableDtoSchema>
export type CharacterConsequenceDto = z.infer<typeof characterConsequenceDtoSchema>
