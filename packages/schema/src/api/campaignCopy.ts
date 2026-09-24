import { z } from '../zod.js'
import { copyCampaignInputSchema, campaignDetailDtoSchema } from './campaignCore.js'
import { campaignNotebookCategoryDtoSchema } from './campaignSessions.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import { timestampSchema, uuidSchema } from './campaignContractSchemas.js'

export const beginCampaignCopyInputSchema = z.extend(copyCampaignInputSchema, {
  notebookCategories: z._default(
    z
      .array(campaignNotebookCategoryDtoSchema)
      .check(z.maxLength(3))
      .check(
        z.refine(
          (categories) => new Set(categories).size === categories.length,
          'Categories must be unique.'
        )
      ),
    []
  )
})
export const campaignCopyLookupSchema = z.strictObject({ copyId: uuidSchema })
export const campaignCopyStatusSchema = z.enum([
  'RUNNING',
  'CLEANING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
])
export const campaignCopyProgressSchema = z.strictObject({
  copyId: uuidSchema,
  sourceCampaignId: uuidSchema,
  sourceName: campaignDetailDtoSchema.shape.name,
  status: campaignCopyStatusSchema,
  notebookCategories: z.array(campaignNotebookCategoryDtoSchema).check(z.maxLength(3)),
  copiedSections: z.number().check(z.int()).check(z.nonnegative()),
  failureReason: z.nullable(z.string().check(z.maxLength(500))),
  destination: z.nullable(campaignDetailDtoSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const campaignCopyListInputSchema = campaignListInputSchema
export const campaignCopyListPageSchema = z.extend(campaignListPageSchema, {
  page: z.array(campaignCopyProgressSchema)
})

export type BeginCampaignCopyInput = z.input<typeof beginCampaignCopyInputSchema>
export type CampaignCopyLookup = z.infer<typeof campaignCopyLookupSchema>
export type CampaignCopyProgress = z.infer<typeof campaignCopyProgressSchema>
export type CampaignCopyListInput = z.infer<typeof campaignCopyListInputSchema>
export type CampaignCopyListPage = z.infer<typeof campaignCopyListPageSchema>
