import { z } from '../zod.js'
import { authoredDraftListInputSchema } from './authoredDrafts.js'
import { socialBlockDtoSchema } from './socialHub.js'
import { socialListingPageSchema } from './socialListingList.js'

export const socialBlockListInputSchema = z.pick(authoredDraftListInputSchema, {
  paginationOpts: true
})
export const socialBlockPageSchema = z.extend(socialListingPageSchema, {
  page: z.array(socialBlockDtoSchema)
})
export const socialBlockStatusSchema = z.strictObject({ blocked: z.boolean() })

export type SocialBlockListInput = z.infer<typeof socialBlockListInputSchema>
export type SocialBlockPage = z.infer<typeof socialBlockPageSchema>
export type SocialBlockStatus = z.infer<typeof socialBlockStatusSchema>
