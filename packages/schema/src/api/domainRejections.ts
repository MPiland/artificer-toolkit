import { z } from '../zod.js'

/** Why an expected Encounter command was refused; unexpected failures never carry a reason. */
export const domainRejectionReasonDtoSchema = z.enum([
  'ACTIVE_ENCOUNTER_EXISTS',
  'CAMPAIGN_NOT_ACTIVE',
  'COMMAND_ID_REUSED',
  'DECISION_NOT_PENDING',
  'DECISION_REQUIRES_ANSWER',
  'ENCOUNTER_NOT_ACTIVE',
  'NOT_CURRENT_ACTOR',
  'PENDING_DECISION',
  'TARGET_UNAVAILABLE',
  'VERSION_STALE'
])
export type DomainRejectionReasonDto = z.infer<typeof domainRejectionReasonDtoSchema>

/** `ConvexError` data for an expected domain rejection. The message is safe to show to users. */
export const domainRejectionErrorDataSchema = z.strictObject({
  code: z.literal('DOMAIN_REJECTED'),
  reason: domainRejectionReasonDtoSchema,
  message: z.string().check(z.minLength(1)).check(z.maxLength(200))
})
export type DomainRejectionErrorData = z.infer<typeof domainRejectionErrorDataSchema>
