import { z } from '../zod.js'
import { authoredDraftListInputSchema } from './authoredDrafts.js'
import { socialListingDtoSchema } from './socialHub.js'

export const socialListingListInputSchema = z.pick(authoredDraftListInputSchema, {
  paginationOpts: true
})
export const socialListingPageSchema = z.strictObject({
  page: z.array(socialListingDtoSchema),
  isDone: z.boolean(),
  continueCursor: z.string(),
  splitCursor: z.optional(z.nullable(z.string())),
  pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
})

export type SocialListingListInput = z.infer<typeof socialListingListInputSchema>
export type SocialListingPage = z.infer<typeof socialListingPageSchema>
