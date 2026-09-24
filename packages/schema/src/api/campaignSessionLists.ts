import { z } from '../zod.js'
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

export const campaignSessionListInputSchema = z.extend(
  listCampaignSessionsInputSchema,
  campaignListInputSchema.shape
)
export const campaignSessionListPageSchema = z.extend(campaignListPageSchema, {
  page: campaignSessionsDtoSchema
})
export const campaignSessionAttendanceListInputSchema = z.extend(
  listCampaignSessionAttendanceInputSchema,
  campaignListInputSchema.shape
)
export const campaignSessionAttendanceListPageSchema = z.extend(campaignListPageSchema, {
  page: campaignSessionAttendanceDtoListSchema
})
export const campaignSessionRsvpListInputSchema = z.extend(
  listCampaignSessionRsvpsInputSchema,
  campaignListInputSchema.shape
)
export const campaignSessionRsvpListPageSchema = z.extend(campaignListPageSchema, {
  page: campaignSessionRsvpDtoListSchema
})
export const campaignSessionNoteListInputSchema = z.extend(
  listCampaignSessionNoteSectionsInputSchema,
  campaignListInputSchema.shape
)
export const campaignSessionNoteListPageSchema = z.extend(campaignListPageSchema, {
  page: campaignSessionNoteSectionsDtoSchema
})
export const campaignSessionReferenceListInputSchema = z.extend(
  listCampaignSessionReferencePinsInputSchema,
  campaignListInputSchema.shape
)
export const campaignSessionReferenceListPageSchema = z.extend(campaignListPageSchema, {
  page: campaignSessionReferencePinsDtoSchema
})

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
