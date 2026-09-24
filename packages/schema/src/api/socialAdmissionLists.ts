import { z } from '../zod.js'
import { authoredDraftListInputSchema } from './authoredDrafts.js'
import { socialListingPageSchema } from './socialListingList.js'
import {
  socialApplicationDtoSchema,
  socialApplicationVersionInputSchema,
  socialListingPublicIdInputSchema
} from './socialHub.js'
import { campaignInviteDtoSchema, campaignInviteVersionInputSchema } from './campaignCore.js'

export const socialAdmissionListInputSchema = z.extend(
  z.pick(authoredDraftListInputSchema, {
    paginationOpts: true
  }),
  { group: z.enum(['PENDING', 'HISTORY']) }
)
export const socialListingAdmissionListInputSchema = z.extend(
  socialListingPublicIdInputSchema,
  socialAdmissionListInputSchema.shape
)
// Keep this horizon fixed while paging; refresh both groups at the next invitation deadline.
export const socialInvitationListInputSchema = z.extend(socialAdmissionListInputSchema, {
  asOf: campaignInviteDtoSchema.shape.expiresAt
})
export const socialInvitationPublicIdInputSchema = z.extend(
  z.pick(campaignInviteVersionInputSchema, { invitePublicId: true }),
  z.pick(socialInvitationListInputSchema, { asOf: true }).shape
)
export const socialListingInvitationPublicIdInputSchema = z.extend(
  socialListingPublicIdInputSchema,
  socialInvitationPublicIdInputSchema.shape
)
export const socialListingInvitationListInputSchema = z.extend(
  socialListingAdmissionListInputSchema,
  z.pick(socialInvitationListInputSchema, { asOf: true }).shape
)
export const socialApplicationPageSchema = z.extend(socialListingPageSchema, {
  page: z.array(socialApplicationDtoSchema)
})
export const socialApplicationPublicIdInputSchema = z.pick(socialApplicationVersionInputSchema, {
  applicationPublicId: true
})
export const socialInvitationPageSchema = z.extend(socialListingPageSchema, {
  page: z.array(campaignInviteDtoSchema)
})

export type SocialAdmissionListInput = z.infer<typeof socialAdmissionListInputSchema>
export type SocialApplicationPublicIdInput = z.infer<typeof socialApplicationPublicIdInputSchema>
export type SocialListingAdmissionListInput = z.infer<typeof socialListingAdmissionListInputSchema>
export type SocialInvitationListInput = z.infer<typeof socialInvitationListInputSchema>
export type SocialInvitationPublicIdInput = z.infer<typeof socialInvitationPublicIdInputSchema>
export type SocialListingInvitationListInput = z.infer<
  typeof socialListingInvitationListInputSchema
>
export type SocialListingInvitationPublicIdInput = z.infer<
  typeof socialListingInvitationPublicIdInputSchema
>
export type SocialApplicationPage = z.infer<typeof socialApplicationPageSchema>
export type SocialInvitationPage = z.infer<typeof socialInvitationPageSchema>
