import { z } from 'zod'

import { authoredRichTextSchema } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredSubjectKindDtoSchema } from './content.js'
import {
  jsonSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

const campaignNameSchema = z.string().trim().min(1).max(100)
const campaignDescriptionSchema = authoredRichTextSchema

export const entitlementTierDtoSchema = z.enum(['FREE', 'PLAYER', 'GM', 'PRO_GM'])
export const entitlementLimitDtoSchema = z.strictObject({
  storageBytes: z.number().int().nonnegative().nullable(),
  personalCharacters: z.number().int().nonnegative().nullable(),
  homebrewRoots: z.number().int().nonnegative().nullable(),
  activeHostedCampaigns: z.number().int().nonnegative().nullable(),
  playerSeatsPerCampaign: z.number().int().positive(),
  publicListings: z.number().int().nonnegative().nullable(),
  savedEncounters: z.number().int().nonnegative().nullable(),
  paidTablesEnabled: z.boolean(),
  platformFeeBasisPoints: z.number().int().nonnegative()
})
export const entitlementUsageDtoSchema = z.strictObject({
  storageBytes: z.number().int().nonnegative(),
  personalCharacters: z.number().int().nonnegative(),
  homebrewRoots: z.number().int().nonnegative(),
  activeHostedCampaigns: z.number().int().nonnegative(),
  publicListings: z.number().int().nonnegative(),
  savedEncounters: z.number().int().nonnegative()
})
export const entitlementPricingDtoSchema = z.strictObject({
  currency: z.literal('USD'),
  monthlyPriceCents: z.number().int().nonnegative(),
  annualPriceCents: z.number().int().nonnegative()
})
export const entitlementProjectionDtoSchema = z.strictObject({
  tier: entitlementTierDtoSchema,
  limits: entitlementLimitDtoSchema,
  usage: entitlementUsageDtoSchema,
  pricing: entitlementPricingDtoSchema
})

export const campaignRoleDtoSchema = z.enum(['OWNER', 'PLAYER'])
export const campaignStatusDtoSchema = z.enum(['ACTIVE', 'ARCHIVED'])
export const campaignVisibilityDtoSchema = z.enum(['PRIVATE', 'PUBLIC'])
export const campaignCapabilitiesDtoSchema = z.strictObject({
  edit: z.boolean(),
  archive: z.boolean(),
  delete: z.boolean(),
  invite: z.boolean(),
  manageMembers: z.boolean(),
  manageCharacters: z.boolean(),
  assignOwnCharacter: z.boolean(),
  manageContent: z.boolean(),
  submitContent: z.boolean(),
  managePartyInventory: z.boolean(),
  transferOwnInventory: z.boolean(),
  manageNotes: z.boolean(),
  contributeSessionNotes: z.boolean(),
  readTableChat: z.boolean(),
  readPartyChat: z.boolean()
})
export const campaignCharacterSummaryDtoSchema = z.strictObject({
  id: uuidSchema,
  publicId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(100),
  systemId: postgresUuidSchema
})
export const campaignMembershipDtoSchema = z.strictObject({
  userId: uuidSchema,
  username: z.string().trim().min(1).max(30),
  role: campaignRoleDtoSchema,
  accessStartedAt: timestampSchema,
  acceptedAt: timestampSchema,
  assignedCharacter: campaignCharacterSummaryDtoSchema.nullable()
})
const campaignBaseDtoSchema = z.strictObject({
  id: uuidSchema,
  publicId: z.string().trim().min(1),
  name: campaignNameSchema,
  description: campaignDescriptionSchema.nullable(),
  status: campaignStatusDtoSchema,
  visibility: campaignVisibilityDtoSchema,
  role: campaignRoleDtoSchema,
  version: versionSchema,
  memberCount: z.number().int().nonnegative(),
  playerCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  capabilities: campaignCapabilitiesDtoSchema,
  assignedCharacter: campaignCharacterSummaryDtoSchema.nullable()
})
export const campaignSummaryDtoSchema = campaignBaseDtoSchema
export const campaignSummariesDtoSchema = z.array(campaignSummaryDtoSchema)
export const campaignDetailDtoSchema = campaignBaseDtoSchema.extend({
  attunementSlotOverride: z.number().int().nonnegative().nullable(),
  memberships: z.array(campaignMembershipDtoSchema)
})
export const createCampaignInputSchema = z.strictObject({
  name: campaignNameSchema,
  description: campaignDescriptionSchema.nullable().optional(),
  visibility: campaignVisibilityDtoSchema.default('PRIVATE')
})
export const campaignPublicIdInputSchema = z.strictObject({
  campaignPublicId: z.string().trim().min(1)
})
export const updateCampaignInputSchema = z.strictObject({
  campaignId: uuidSchema,
  name: campaignNameSchema.optional(),
  description: campaignDescriptionSchema.nullable().optional(),
  attunementSlotOverride: z.number().int().nonnegative().nullable().optional(),
  visibility: campaignVisibilityDtoSchema.optional(),
  expectedVersion: versionSchema
})
const campaignVersionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  expectedVersion: versionSchema
})
export const archiveCampaignInputSchema = campaignVersionInputSchema
export const deleteCampaignInputSchema = campaignVersionInputSchema.extend({
  confirmation: z.literal('DELETE')
})
export const campaignIdInputSchema = z.strictObject({ campaignId: uuidSchema })
export const leaveCampaignInputSchema = campaignIdInputSchema
export const removeCampaignMemberInputSchema = z.strictObject({
  campaignId: uuidSchema,
  userId: uuidSchema
})
export const assignCampaignCharacterInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema
})
export const unassignCampaignCharacterInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema.optional()
})

export const campaignInviteKindDtoSchema = z.enum(['LINK', 'USERNAME', 'EMAIL'])
export const createCampaignInviteInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    kind: campaignInviteKindDtoSchema,
    target: z.string().trim().min(1).max(320).optional(),
    expiresAt: timestampSchema.optional()
  })
  .superRefine(({ kind, target }, context) => {
    if (kind === 'LINK' && target !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'Link invites cannot target an account.'
      })
    if (kind !== 'LINK' && target === undefined)
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'Target is required for direct invites.'
      })
  })
export const campaignInviteDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  kind: campaignInviteKindDtoSchema,
  token: z.string().min(1),
  expiresAt: timestampSchema,
  createdAt: timestampSchema
})
export const acceptCampaignInviteInputSchema = z.strictObject({ token: z.string().min(1).max(512) })
export const revokeCampaignInviteInputSchema = z.strictObject({
  campaignId: uuidSchema,
  inviteId: uuidSchema
})
export const requestCampaignOwnershipTransferInputSchema = z.strictObject({
  campaignId: uuidSchema,
  recipientUserId: uuidSchema
})
export const acceptCampaignOwnershipTransferInputSchema = z.strictObject({ campaignId: uuidSchema })

export const campaignContentBindingDtoSchema = z.strictObject({
  id: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  version: versionSchema,
  snapshot: jsonSchema,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  createdAt: timestampSchema,
  reviewedAt: timestampSchema.nullable()
})
export const campaignContentBindingsDtoSchema = z.array(campaignContentBindingDtoSchema)
export const campaignCharacterBindingSummaryDtoSchema = z.strictObject({
  characterId: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  campaignContentBindingId: uuidSchema,
  version: versionSchema
})
export const submitCampaignContentVersionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  version: versionSchema,
  snapshot: jsonSchema
})
export const reviewCampaignContentVersionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  contentVersionId: uuidSchema,
  decision: z.enum(['APPROVE', 'REJECT'])
})

export type EntitlementTierDto = z.infer<typeof entitlementTierDtoSchema>
export type EntitlementLimitDto = z.infer<typeof entitlementLimitDtoSchema>
export type EntitlementUsageDto = z.infer<typeof entitlementUsageDtoSchema>
export type EntitlementPricingDto = z.infer<typeof entitlementPricingDtoSchema>
export type EntitlementProjectionDto = z.infer<typeof entitlementProjectionDtoSchema>
export type CampaignSummaryDto = z.infer<typeof campaignSummaryDtoSchema>
export type CampaignDetailDto = z.infer<typeof campaignDetailDtoSchema>
export type CreateCampaignInput = z.input<typeof createCampaignInputSchema>
export type CampaignPublicIdInput = z.input<typeof campaignPublicIdInputSchema>
export type UpdateCampaignInput = z.input<typeof updateCampaignInputSchema>
export type CampaignInviteDto = z.infer<typeof campaignInviteDtoSchema>
export type CreateCampaignInviteInput = z.input<typeof createCampaignInviteInputSchema>
export type CampaignContentBindingDto = z.infer<typeof campaignContentBindingDtoSchema>
export type CampaignContentBindingsDto = z.infer<typeof campaignContentBindingsDtoSchema>
export type CampaignCharacterBindingSummaryDto = z.infer<
  typeof campaignCharacterBindingSummaryDtoSchema
>
export type SubmitCampaignContentVersionInput = z.input<
  typeof submitCampaignContentVersionInputSchema
>
export type ReviewCampaignContentVersionInput = z.input<
  typeof reviewCampaignContentVersionInputSchema
>
