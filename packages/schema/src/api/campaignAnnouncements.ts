import { z } from 'zod'

import { timestampSchema, uuidSchema } from './campaignContractSchemas.js'

export const campaignAnnouncementScopeDtoSchema = z.enum(['TABLE', 'PARTY'])
function validateAnnouncementTarget(
  value: { scope: 'TABLE' | 'PARTY'; partyId: string | null },
  context: z.RefinementCtx
): void {
  if ((value.scope === 'PARTY') !== (value.partyId !== null))
    context.addIssue({
      code: 'custom',
      path: ['partyId'],
      message: 'Party scope requires a party.'
    })
}
const announcementTitleSchema = z.string().trim().min(1).max(120)
const announcementBodySchema = z.string().trim().min(1).max(10_000)

export const campaignAnnouncementDtoSchema = z
  .strictObject({
    announcementPublicId: uuidSchema,
    campaignId: uuidSchema,
    authorUserId: uuidSchema,
    scope: campaignAnnouncementScopeDtoSchema,
    partyId: uuidSchema.nullable(),
    title: announcementTitleSchema,
    body: announcementBodySchema,
    createdAt: timestampSchema
  })
  .superRefine(validateAnnouncementTarget)
export const campaignAnnouncementsDtoSchema = z.array(campaignAnnouncementDtoSchema)

export const createCampaignAnnouncementInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    commandId: uuidSchema,
    scope: campaignAnnouncementScopeDtoSchema,
    partyId: uuidSchema.nullable().default(null),
    title: announcementTitleSchema,
    body: announcementBodySchema
  })
  .superRefine(validateAnnouncementTarget)
export const listCampaignAnnouncementsInputSchema = z.strictObject({
  campaignId: uuidSchema
})
export const getCampaignAnnouncementInputSchema = z.strictObject({
  campaignId: uuidSchema,
  announcementPublicId: uuidSchema
})

export type CampaignAnnouncementDto = z.infer<typeof campaignAnnouncementDtoSchema>
export type CreateCampaignAnnouncementInput = z.input<typeof createCampaignAnnouncementInputSchema>
