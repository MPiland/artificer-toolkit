import { z } from '../zod.js'
import { timestampSchema } from './campaignContractSchemas.js'
import { socialSearchBackfillInputSchema } from './socialDiscovery.js'

export const socialRetentionPreviewInputSchema = z.extend(socialSearchBackfillInputSchema, {
  phase: z.enum(['INVITATIONS', 'REPORTS', 'APPLICATIONS', 'RATE_WINDOWS']),
  asOf: timestampSchema.check(
    z.refine(
      (value) => new Date(value).toISOString() === value,
      'Use a canonical millisecond UTC cutoff.'
    )
  )
})

export const socialRetentionPreviewResultSchema = z.strictObject({
  scanned: z.number().check(z.int()).check(z.gte(0)).check(z.lte(8)),
  eligible: z.number().check(z.int()).check(z.gte(0)).check(z.lte(8)),
  continueCursor: z.string(),
  isDone: z.boolean(),
  splitCursor: z.optional(z.nullable(z.string())),
  pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
})

export type SocialRetentionPreviewInput = z.infer<typeof socialRetentionPreviewInputSchema>
export type SocialRetentionPreviewResult = z.infer<typeof socialRetentionPreviewResultSchema>

export const socialRetentionApplyInputSchema = z.extend(socialRetentionPreviewInputSchema, {
  confirm: z.literal('purge-expired-social-data')
})

export const socialRetentionApplyResultSchema = z.extend(socialRetentionPreviewResultSchema, {
  deleted: z.number().check(z.int()).check(z.gte(0)).check(z.lte(8))
})

export type SocialRetentionApplyInput = z.infer<typeof socialRetentionApplyInputSchema>
export type SocialRetentionApplyResult = z.infer<typeof socialRetentionApplyResultSchema>
