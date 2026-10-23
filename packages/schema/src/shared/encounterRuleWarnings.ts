import { z, lazySchema } from '../zod.js'

/**
 * Assisted-mode rule checks the actor may override with "Do it anyway" (ADR 0034 decision 2).
 * Authorization, stale versions, missing targets, acting out of turn and invalid game state are
 * never warnings.
 */
export const encounterRuleWarningCodeDtoSchema = lazySchema(() =>
  z.enum([
    'ACTION_ECONOMY_UNAVAILABLE',
    'CONDITION_SOURCE_APPROACH',
    'CONDITION_SOURCE_FLEE',
    'RESOURCE_UNAVAILABLE',
    'RETURN_SPACE_OCCUPIED',
    'SOURCE_NOT_EQUIPPED',
    'TARGET_DEFEATED',
    'TARGET_CREATURE_TYPE_EXCLUDED',
    'TARGET_DISPOSITION',
    'TARGET_INTELLIGENCE_EXCLUDED',
    'TARGET_NOT_DEAD',
    'TARGET_NOT_DYING',
    'TARGET_NOTHING_TO_END',
    'TARGET_OUT_OF_RANGE',
    'TARGET_OUT_OF_SIGHT',
    'TARGET_RANGE_UNCHECKED',
    'TARGET_TOO_LARGE'
  ])
)
export type EncounterRuleWarningCodeDto = z.infer<typeof encounterRuleWarningCodeDtoSchema>

export const encounterRuleWarningDtoSchema = lazySchema(() =>
  z.strictObject({
    code: encounterRuleWarningCodeDtoSchema,
    message: z.string().check(z.minLength(1)).check(z.maxLength(200))
  })
)
export type EncounterRuleWarningDto = z.infer<typeof encounterRuleWarningDtoSchema>

const uniqueCodes = <T>(code: (value: T) => string) =>
  z.superRefine((values: T[], context) => {
    if (new Set(values.map(code)).size !== values.length)
      context.addIssue({ code: 'custom', message: 'Rule warning codes must be unique.' })
  })

/** At most one warning per code; the room and the web show them in this order. */
export const encounterRuleWarningsDtoSchema = lazySchema(() =>
  z
    .array(encounterRuleWarningDtoSchema)
    .check(z.maxLength(encounterRuleWarningCodeDtoSchema.options.length))
    .check(uniqueCodes((warning: EncounterRuleWarningDto) => warning.code))
)

/** The warning codes a command overrides; part of the command fingerprint. */
export const encounterAcknowledgedRuleWarningsDtoSchema = lazySchema(() =>
  z
    .array(encounterRuleWarningCodeDtoSchema)
    .check(z.maxLength(encounterRuleWarningCodeDtoSchema.options.length))
    .check(uniqueCodes((code: EncounterRuleWarningCodeDto) => code))
)
