import { z, lazySchema } from '../zod.js'
import { keywordSearchSchema } from '../shared/keywordSearch.js'
import { socialDiscoveryInputSchema } from './socialHub.js'
import { socialListingListInputSchema } from './socialListingList.js'

export const socialBrowseInputSchema = lazySchema(() =>
  z.extend(
    z.omit(socialDiscoveryInputSchema, { query: true, cursor: true, limit: true }),
    socialListingListInputSchema.shape
  )
)

export const socialSearchInputSchema = lazySchema(() =>
  z.extend(socialBrowseInputSchema, {
    query: keywordSearchSchema.check(z.maxLength(200)),
    paginationOpts: z.extend(socialListingListInputSchema.shape.paginationOpts, {
      numItems: z.number().check(z.int()).check(z.gte(1)).check(z.lte(8))
    })
  })
)

export const socialSearchBackfillInputSchema = lazySchema(() =>
  z.extend(socialListingListInputSchema, {
    paginationOpts: z.extend(socialListingListInputSchema.shape.paginationOpts, {
      numItems: z.number().check(z.int()).check(z.gte(1)).check(z.lte(8))
    })
  })
)
export const socialSearchBackfillResultSchema = lazySchema(() =>
  z.strictObject({
    processed: z.number().check(z.int()).check(z.gte(0)).check(z.lte(8)),
    continueCursor: z.string(),
    isDone: z.boolean()
  })
)

export type SocialBrowseInput = z.infer<typeof socialBrowseInputSchema>
export type SocialSearchInput = z.infer<typeof socialSearchInputSchema>
