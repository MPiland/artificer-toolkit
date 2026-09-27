import { z, lazySchema } from '../zod.js'
import { authoredDraftListInputSchema } from './authoredDrafts.js'
import { socialBlockDtoSchema } from './socialHub.js'
import { socialListingPageSchema } from './socialListingList.js'

export const socialBlockListInputSchema = lazySchema(() =>
  z.pick(authoredDraftListInputSchema, {
    paginationOpts: true
  })
)
export const socialBlockPageSchema = lazySchema(() =>
  z.extend(socialListingPageSchema, {
    page: z.array(socialBlockDtoSchema)
  })
)
export const socialBlockStatusSchema = lazySchema(() => z.strictObject({ blocked: z.boolean() }))

export type SocialBlockListInput = z.infer<typeof socialBlockListInputSchema>
export type SocialBlockPage = z.infer<typeof socialBlockPageSchema>
export type SocialBlockStatus = z.infer<typeof socialBlockStatusSchema>
