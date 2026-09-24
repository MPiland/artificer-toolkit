import { z } from '../zod.js'
import { authoredDraftListInputSchema } from './authoredDrafts.js'
import { campaignSummaryDtoSchema } from './campaignCore.js'

export const campaignLookupInputSchema = z.strictObject({
  id: z.string().check(z.minLength(1)).check(z.maxLength(240))
})
export const campaignListInputSchema = z.pick(authoredDraftListInputSchema, {
  paginationOpts: true
})
export const campaignListPageSchema = z.strictObject({
  page: z.array(campaignSummaryDtoSchema),
  isDone: z.boolean(),
  continueCursor: z.string(),
  splitCursor: z.optional(z.nullable(z.string())),
  pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
})

export type CampaignListInput = z.infer<typeof campaignListInputSchema>
export type CampaignListPage = z.infer<typeof campaignListPageSchema>
export type CampaignLookupInput = z.infer<typeof campaignLookupInputSchema>
