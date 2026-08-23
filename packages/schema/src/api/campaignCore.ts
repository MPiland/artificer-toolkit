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
const campaignToneDetailsSchema = z.string().trim().min(1).max(1_000)

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
export const campaignFormatDtoSchema = z.enum(['ONE_SHOT', 'ONGOING'])
export const campaignToneTagDtoSchema = z.enum([
  'LIGHTHEARTED',
  'HEROIC',
  'SERIOUS',
  'DARK',
  'GRITTY',
  'HORROR',
  'COMEDIC',
  'COZY'
])
export const campaignContentMaturityDtoSchema = z.enum(['STANDARD', 'MATURE'])
export const campaignToneTagsDtoSchema = z
  .array(campaignToneTagDtoSchema)
  .min(1)
  .max(3)
  .refine((tags) => new Set(tags).size === tags.length, 'Tone tags must be unique.')
export const campaignCapabilitiesDtoSchema = z.strictObject({
  edit: z.boolean(),
  archive: z.boolean(),
  delete: z.boolean(),
  invite: z.boolean(),
  manageMembers: z.boolean(),
  manageCharacters: z.boolean(),
  assignOwnCharacter: z.boolean(),
  manageSharedContent: z.boolean(),
  shareOwnedContent: z.boolean(),
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
  format: campaignFormatDtoSchema,
  toneTags: campaignToneTagsDtoSchema,
  toneDetails: campaignToneDetailsSchema.nullable(),
  contentMaturity: campaignContentMaturityDtoSchema,
  status: campaignStatusDtoSchema,
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
  format: campaignFormatDtoSchema,
  toneTags: campaignToneTagsDtoSchema,
  toneDetails: campaignToneDetailsSchema.nullable().optional(),
  contentMaturity: campaignContentMaturityDtoSchema
})
export const campaignPublicIdInputSchema = z.strictObject({
  campaignPublicId: z.string().trim().min(1)
})
export const updateCampaignInputSchema = z.strictObject({
  campaignId: uuidSchema,
  name: campaignNameSchema.optional(),
  description: campaignDescriptionSchema.nullable().optional(),
  format: campaignFormatDtoSchema.optional(),
  toneTags: campaignToneTagsDtoSchema.optional(),
  toneDetails: campaignToneDetailsSchema.nullable().optional(),
  contentMaturity: campaignContentMaturityDtoSchema.optional(),
  attunementSlotOverride: z.number().int().nonnegative().nullable().optional(),
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
export const copyCampaignInputSchema = campaignVersionInputSchema.extend({ commandId: uuidSchema })
export const campaignIdInputSchema = z.strictObject({ campaignId: uuidSchema })
export const leaveCampaignInputSchema = z.strictObject({
  campaignId: uuidSchema,
  expectedCampaignVersion: versionSchema,
  expectedMembershipAccessStartedAt: timestampSchema,
  commandId: uuidSchema
})
export const removeCampaignMemberInputSchema = z.strictObject({
  campaignId: uuidSchema,
  userId: uuidSchema,
  expectedCampaignVersion: versionSchema,
  expectedMembershipAccessStartedAt: timestampSchema,
  commandId: uuidSchema
})
export const assignCampaignCharacterInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema
})
export const unassignCampaignCharacterInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema.optional()
})

export const campaignInviteStatusDtoSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'REVOKED',
  'EXPIRED'
])
export const listSentCampaignInvitesInputSchema = z.strictObject({
  listingPublicId: uuidSchema
})
export const createCampaignInviteInputSchema = z.strictObject({
  listingPublicId: uuidSchema,
  expectedListingVersion: versionSchema,
  username: z.string().trim().min(3).max(30),
  expiresAt: timestampSchema.optional()
})
export const campaignInviteDtoSchema = z.strictObject({
  invitePublicId: uuidSchema,
  listingPublicId: uuidSchema,
  listingTitle: z.string().trim().min(1).max(100),
  hostProfilePublicId: uuidSchema,
  hostUsername: z.string().trim().min(3).max(30),
  recipientUsername: z.string().trim().min(3).max(30),
  status: campaignInviteStatusDtoSchema,
  expiresAt: timestampSchema,
  respondedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  version: versionSchema
})
export const campaignInviteVersionInputSchema = z.strictObject({
  invitePublicId: uuidSchema,
  expectedVersion: versionSchema
})
export const acceptCampaignInviteInputSchema = campaignInviteVersionInputSchema
export const declineCampaignInviteInputSchema = campaignInviteVersionInputSchema
export const revokeCampaignInviteInputSchema = campaignInviteVersionInputSchema
export const requestCampaignOwnershipTransferInputSchema = z.strictObject({
  campaignId: uuidSchema,
  recipientUserId: uuidSchema
})
export const acceptCampaignOwnershipTransferInputSchema = z.strictObject({ campaignId: uuidSchema })

export const campaignContentShareDtoSchema = z.strictObject({
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  document: jsonSchema,
  sharedBy: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const campaignContentSharesDtoSchema = z.array(campaignContentShareDtoSchema)
export const shareCampaignContentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema
})
export const unshareCampaignContentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  sharedBy: uuidSchema,
  expectedCampaignVersion: versionSchema,
  commandId: uuidSchema
})
export const campaignContentRemovalReceiptDtoSchema = z.strictObject({
  eventId: uuidSchema,
  campaignVersion: versionSchema,
  removedShares: z.array(
    z.strictObject({
      subjectKind: authoredSubjectKindDtoSchema,
      subjectId: uuidSchema,
      sharedBy: uuidSchema
    })
  ),
  affectedCharacters: z.array(
    z.strictObject({
      characterId: uuidSchema,
      status: z.enum(['ACTIVE', 'DRAFT']),
      streamVersion: versionSchema
    })
  ),
  evacuatedVehicles: z.array(
    z.strictObject({
      vehicleId: uuidSchema,
      vehicleDefinitionId: uuidSchema,
      transferredTopLevelItemIds: z.array(uuidSchema),
      transferredCurrencyGroupIds: z.array(uuidSchema)
    })
  )
})

export type EntitlementTierDto = z.infer<typeof entitlementTierDtoSchema>
export type EntitlementLimitDto = z.infer<typeof entitlementLimitDtoSchema>
export type EntitlementUsageDto = z.infer<typeof entitlementUsageDtoSchema>
export type EntitlementPricingDto = z.infer<typeof entitlementPricingDtoSchema>
export type EntitlementProjectionDto = z.infer<typeof entitlementProjectionDtoSchema>
export type CampaignSummaryDto = z.infer<typeof campaignSummaryDtoSchema>
export type CampaignDetailDto = z.infer<typeof campaignDetailDtoSchema>
export type CampaignFormatDto = z.infer<typeof campaignFormatDtoSchema>
export type CampaignToneTagDto = z.infer<typeof campaignToneTagDtoSchema>
export type CampaignContentMaturityDto = z.infer<typeof campaignContentMaturityDtoSchema>
export type CreateCampaignInput = z.input<typeof createCampaignInputSchema>
export type CopyCampaignInput = z.input<typeof copyCampaignInputSchema>
export type CampaignPublicIdInput = z.input<typeof campaignPublicIdInputSchema>
export type UpdateCampaignInput = z.input<typeof updateCampaignInputSchema>
export type CampaignInviteDto = z.infer<typeof campaignInviteDtoSchema>
export type CreateCampaignInviteInput = z.input<typeof createCampaignInviteInputSchema>
export type CampaignContentShareDto = z.infer<typeof campaignContentShareDtoSchema>
export type CampaignContentSharesDto = z.infer<typeof campaignContentSharesDtoSchema>
export type ShareCampaignContentInput = z.input<typeof shareCampaignContentInputSchema>
export type UnshareCampaignContentInput = z.input<typeof unshareCampaignContentInputSchema>
export type CampaignContentRemovalReceiptDto = z.infer<
  typeof campaignContentRemovalReceiptDtoSchema
>
