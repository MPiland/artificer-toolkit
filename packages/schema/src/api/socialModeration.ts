import { z } from '../zod.js'
import {
  socialReportEvidenceSchema,
  socialStoredReportSchema
} from '../projections/socialModerationPersistence.js'
import { socialListingListInputSchema } from './socialListingList.js'
import {
  socialModerationQueueItemDtoSchema,
  socialModerationReportDtoSchema,
  takeSocialModerationActionInputSchema
} from './socialHub.js'

export const socialModerationQueueInputSchema = socialListingListInputSchema
export const socialModerationEvidenceDtoSchema = z.extend(socialModerationReportDtoSchema, {
  details: socialStoredReportSchema.shape.details,
  evidence: socialReportEvidenceSchema
})
export type SocialModerationEvidenceDto = z.infer<typeof socialModerationEvidenceDtoSchema>
export const socialModerationQueuePageSchema = z.strictObject({
  page: z.array(socialModerationQueueItemDtoSchema),
  isDone: z.boolean(),
  continueCursor: z.string(),
  splitCursor: z.optional(z.nullable(z.string())),
  pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
})

export const socialReportReviewInputSchema = z.extend(takeSocialModerationActionInputSchema, {
  action: z.enum(['START_REVIEW', 'RESOLVE', 'DISMISS'])
})

export const socialListingModerationInputSchema = z.extend(takeSocialModerationActionInputSchema, {
  action: z.enum(['HIDE_LISTING', 'RESTORE_LISTING'])
})

export type SocialModerationQueuePage = z.infer<typeof socialModerationQueuePageSchema>

export const socialProfileModerationInputSchema = z.extend(takeSocialModerationActionInputSchema, {
  action: z.enum(['SUSPEND_PROFILE', 'RESTORE_PROFILE'])
})
