import { z } from '../zod.js'

import { timestampSchema, uuidSchema } from './campaignContractSchemas.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'

export const campaignAnnouncementScopeDtoSchema = z.enum(['TABLE', 'PARTY'])
function validateAnnouncementTarget(
  value: { scope: 'TABLE' | 'PARTY'; partyId: string | null },
  context: z.core.$RefinementCtx
): void {
  if ((value.scope === 'PARTY') !== (value.partyId !== null))
    context.addIssue({
      code: 'custom',
      path: ['partyId'],
      message: 'Party scope requires a party.'
    })
}
function validateCreateAnnouncementTarget(
  value: { scope: 'TABLE' | 'PARTY'; partyId: string | null },
  context: z.core.$RefinementCtx
): void {
  if (value.scope === 'TABLE' && value.partyId !== null)
    context.addIssue({
      code: 'custom',
      path: ['partyId'],
      message: 'Table scope cannot target a party.'
    })
}
const announcementTitleSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(120))
const announcementBodySchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(10_000))

export const campaignAnnouncementDtoSchema = z
  .strictObject({
    announcementPublicId: uuidSchema,
    campaignId: uuidSchema,
    authorUserId: uuidSchema,
    scope: campaignAnnouncementScopeDtoSchema,
    partyId: z.nullable(uuidSchema),
    title: announcementTitleSchema,
    body: announcementBodySchema,
    createdAt: timestampSchema
  })
  .check(z.superRefine(validateAnnouncementTarget))
export const campaignAnnouncementsDtoSchema = z.array(campaignAnnouncementDtoSchema)

export const createCampaignAnnouncementInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    commandId: uuidSchema,
    scope: campaignAnnouncementScopeDtoSchema,
    partyId: z._default(z.nullable(uuidSchema), null),
    title: announcementTitleSchema,
    body: announcementBodySchema
  })
  .check(z.superRefine(validateCreateAnnouncementTarget))
export const listCampaignAnnouncementsInputSchema = z.strictObject({
  campaignId: uuidSchema
})
export const getCampaignAnnouncementInputSchema = z.strictObject({
  campaignId: uuidSchema,
  announcementPublicId: uuidSchema
})

export const campaignAnnouncementListInputSchema = z.extend(
  listCampaignAnnouncementsInputSchema,
  campaignListInputSchema.shape
)
export const campaignAnnouncementListPageSchema = z.extend(campaignListPageSchema, {
  page: z.array(campaignAnnouncementDtoSchema)
})

export type CampaignAnnouncementDto = z.infer<typeof campaignAnnouncementDtoSchema>
export type CreateCampaignAnnouncementInput = z.input<typeof createCampaignAnnouncementInputSchema>
export type CampaignAnnouncementListInput = z.infer<typeof campaignAnnouncementListInputSchema>
export type CampaignAnnouncementListPage = z.infer<typeof campaignAnnouncementListPageSchema>
