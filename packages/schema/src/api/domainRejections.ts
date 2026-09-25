import { z } from '../zod.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'

const reasonsWithoutPayload = [
  'ACTIVE_ENCOUNTER_EXISTS',
  'CAMPAIGN_NOT_ACTIVE',
  'COMMAND_ID_REUSED',
  'DECISION_NOT_PENDING',
  'DECISION_REQUIRES_ANSWER',
  'ENCOUNTER_NOT_ACTIVE',
  'NOT_ACTOR_CONTROLLER',
  'NOT_CURRENT_ACTOR',
  'PENDING_DECISION',
  'REVERT_UNAVAILABLE',
  'ROLL_UNAVAILABLE',
  'TARGET_UNAVAILABLE',
  'VERSION_STALE'
] as const

/** Why an expected Encounter command was refused; unexpected failures never carry a reason. */
export const domainRejectionReasonDtoSchema = z.enum([...reasonsWithoutPayload, 'RULE_WARNINGS'])
export type DomainRejectionReasonDto = z.infer<typeof domainRejectionReasonDtoSchema>

const messageSchema = z.string().check(z.minLength(1)).check(z.maxLength(200))

/**
 * `ConvexError` data for an expected domain rejection. The message is safe to show to users.
 * `RULE_WARNINGS` also lists the overridable warnings the command did not acknowledge.
 */
export const domainRejectionErrorDataSchema = z.discriminatedUnion('reason', [
  z.strictObject({
    code: z.literal('DOMAIN_REJECTED'),
    reason: z.enum(reasonsWithoutPayload),
    message: messageSchema
  }),
  z.strictObject({
    code: z.literal('DOMAIN_REJECTED'),
    reason: z.literal('RULE_WARNINGS'),
    message: messageSchema,
    warnings: encounterRuleWarningsDtoSchema.check(z.minLength(1))
  })
])
export type DomainRejectionErrorData = z.infer<typeof domainRejectionErrorDataSchema>
