import { z, lazySchema } from '../zod.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import {
  campaignSessionsDtoSchema,
  campaignSessionAttendanceDtoListSchema,
  campaignSessionRsvpDtoListSchema,
  campaignSessionNoteSectionsDtoSchema,
  campaignSessionReferencePinsDtoSchema,
  listCampaignSessionsInputSchema,
  listCampaignSessionAttendanceInputSchema,
  listCampaignSessionRsvpsInputSchema,
  listCampaignSessionNoteSectionsInputSchema,
  listCampaignSessionReferencePinsInputSchema
} from './campaignSessions.js'

export const campaignSessionListInputSchema = lazySchema(() =>
  z.extend(listCampaignSessionsInputSchema, campaignListInputSchema.shape)
)
export const campaignSessionListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: campaignSessionsDtoSchema
  })
)
export const campaignSessionAttendanceListInputSchema = lazySchema(() =>
  z.extend(listCampaignSessionAttendanceInputSchema, campaignListInputSchema.shape)
)
export const campaignSessionAttendanceListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: campaignSessionAttendanceDtoListSchema
  })
)
export const campaignSessionRsvpListInputSchema = lazySchema(() =>
  z.extend(listCampaignSessionRsvpsInputSchema, campaignListInputSchema.shape)
)
export const campaignSessionRsvpListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: campaignSessionRsvpDtoListSchema
  })
)
export const campaignSessionNoteListInputSchema = lazySchema(() =>
  z.extend(listCampaignSessionNoteSectionsInputSchema, campaignListInputSchema.shape)
)
export const campaignSessionNoteListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: campaignSessionNoteSectionsDtoSchema
  })
)
export const campaignSessionReferenceListInputSchema = lazySchema(() =>
  z.extend(listCampaignSessionReferencePinsInputSchema, campaignListInputSchema.shape)
)
export const campaignSessionReferenceListPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: campaignSessionReferencePinsDtoSchema
  })
)

export type CampaignSessionListInput = z.infer<typeof campaignSessionListInputSchema>
export type CampaignSessionListPage = z.infer<typeof campaignSessionListPageSchema>
export type CampaignSessionAttendanceListInput = z.infer<
  typeof campaignSessionAttendanceListInputSchema
>
export type CampaignSessionAttendanceListPage = z.infer<
  typeof campaignSessionAttendanceListPageSchema
>
export type CampaignSessionRsvpListInput = z.infer<typeof campaignSessionRsvpListInputSchema>
export type CampaignSessionRsvpListPage = z.infer<typeof campaignSessionRsvpListPageSchema>
export type CampaignSessionNoteListInput = z.infer<typeof campaignSessionNoteListInputSchema>
export type CampaignSessionNoteListPage = z.infer<typeof campaignSessionNoteListPageSchema>
export type CampaignSessionReferenceListInput = z.infer<
  typeof campaignSessionReferenceListInputSchema
>
export type CampaignSessionReferenceListPage = z.infer<
  typeof campaignSessionReferenceListPageSchema
>
