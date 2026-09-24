import { z } from '../zod.js'

import { authoredRichTextSchema } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredSubjectKindSchema } from '../projections/identity.js'
import { entitlementTierDtoSchema } from './accountEntitlements.js'
export { entitlementTierDtoSchema }
import {
  jsonSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

const campaignNameSchema = z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100))
const campaignDescriptionSchema = authoredRichTextSchema
const campaignToneDetailsSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(1_000))
export const MAX_CAMPAIGN_RULES_CATALOGUES = 32
const additionalRulesCatalogueIdsSchema = z
  .array(postgresUuidSchema)
  .check(z.maxLength(MAX_CAMPAIGN_RULES_CATALOGUES - 1))
  .check(z.refine((ids) => new Set(ids).size === ids.length, 'Rules Catalogues must be unique.'))

export const entitlementLimitDtoSchema = z.strictObject({
  storageBytes: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  personalCharacters: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  homebrewRoots: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  activeHostedCampaigns: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  playerSeatsPerCampaign: z.number().check(z.int()).check(z.positive()),
  publicListings: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  savedEncounters: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  paidTablesEnabled: z.boolean(),
  platformFeeBasisPoints: z.number().check(z.int()).check(z.nonnegative())
})
export const entitlementUsageDtoSchema = z.strictObject({
  storageBytes: z.number().check(z.int()).check(z.nonnegative()),
  personalCharacters: z.number().check(z.int()).check(z.nonnegative()),
  homebrewRoots: z.number().check(z.int()).check(z.nonnegative()),
  activeHostedCampaigns: z.number().check(z.int()).check(z.nonnegative()),
  publicListings: z.number().check(z.int()).check(z.nonnegative()),
  savedEncounters: z.number().check(z.int()).check(z.nonnegative())
})
export const entitlementPricingDtoSchema = z.strictObject({
  currency: z.literal('USD'),
  monthlyPriceCents: z.number().check(z.int()).check(z.nonnegative()),
  annualPriceCents: z.number().check(z.int()).check(z.nonnegative())
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
  .check(z.minLength(1))
  .check(z.maxLength(3))
  .check(z.refine((tags) => new Set(tags).size === tags.length, 'Tone tags must be unique.'))
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
  publicId: z.string().check(z.trim()).check(z.minLength(1)),
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)),
  systemId: postgresUuidSchema
})
export const campaignMembershipDtoSchema = z.strictObject({
  userId: uuidSchema,
  username: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(30)),
  role: campaignRoleDtoSchema,
  accessStartedAt: timestampSchema,
  acceptedAt: timestampSchema,
  assignedCharacter: z.nullable(campaignCharacterSummaryDtoSchema)
})
const campaignBaseDtoSchema = z.strictObject({
  id: uuidSchema,
  publicId: z.string().check(z.trim()).check(z.minLength(1)),
  name: campaignNameSchema,
  description: z.nullable(campaignDescriptionSchema),
  format: campaignFormatDtoSchema,
  toneTags: campaignToneTagsDtoSchema,
  toneDetails: z.nullable(campaignToneDetailsSchema),
  contentMaturity: campaignContentMaturityDtoSchema,
  gameSystemId: postgresUuidSchema,
  primaryRulesCatalogueId: postgresUuidSchema,
  additionalRulesCatalogueIds: additionalRulesCatalogueIdsSchema,
  status: campaignStatusDtoSchema,
  role: campaignRoleDtoSchema,
  version: versionSchema,
  memberCount: z.number().check(z.int()).check(z.nonnegative()),
  playerCount: z.number().check(z.int()).check(z.nonnegative()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  capabilities: campaignCapabilitiesDtoSchema,
  assignedCharacter: z.nullable(campaignCharacterSummaryDtoSchema)
})
export const campaignSummaryDtoSchema = campaignBaseDtoSchema
export const campaignSummariesDtoSchema = z.array(campaignSummaryDtoSchema)
export const campaignDetailDtoSchema = z.extend(campaignBaseDtoSchema, {
  attunementSlotOverride: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
  memberships: z.array(campaignMembershipDtoSchema)
})
export const createCampaignInputSchema = z
  .strictObject({
    name: campaignNameSchema,
    description: z.optional(z.nullable(campaignDescriptionSchema)),
    format: campaignFormatDtoSchema,
    toneTags: campaignToneTagsDtoSchema,
    toneDetails: z.optional(z.nullable(campaignToneDetailsSchema)),
    contentMaturity: campaignContentMaturityDtoSchema,
    gameSystemId: postgresUuidSchema,
    primaryRulesCatalogueId: postgresUuidSchema,
    additionalRulesCatalogueIds: z._default(additionalRulesCatalogueIdsSchema, [])
  })
  .check(
    z.superRefine((input, context) => {
      if (input.additionalRulesCatalogueIds.includes(input.primaryRulesCatalogueId)) {
        context.addIssue({
          code: 'custom',
          path: ['additionalRulesCatalogueIds'],
          message: 'The primary Rules Catalogue is enabled implicitly and cannot be additional.'
        })
      }
    })
  )
export const campaignPublicIdInputSchema = z.strictObject({
  campaignPublicId: z.string().check(z.trim()).check(z.minLength(1))
})
export const updateCampaignInputSchema = z.strictObject({
  campaignId: uuidSchema,
  name: z.optional(campaignNameSchema),
  description: z.optional(z.nullable(campaignDescriptionSchema)),
  format: z.optional(campaignFormatDtoSchema),
  toneTags: z.optional(campaignToneTagsDtoSchema),
  toneDetails: z.optional(z.nullable(campaignToneDetailsSchema)),
  contentMaturity: z.optional(campaignContentMaturityDtoSchema),
  attunementSlotOverride: z.optional(z.nullable(z.number().check(z.int()).check(z.nonnegative()))),
  primaryRulesCatalogueId: z.optional(postgresUuidSchema),
  additionalRulesCatalogueIds: z.optional(additionalRulesCatalogueIdsSchema),
  expectedVersion: versionSchema
})
const campaignVersionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  expectedVersion: versionSchema
})
export const archiveCampaignInputSchema = campaignVersionInputSchema
export const deleteCampaignInputSchema = z.extend(campaignVersionInputSchema, {
  confirmation: z.literal('DELETE')
})
export const campaignDeletionResultSchema = z.strictObject({ ok: z.literal(true) })
export const copyCampaignInputSchema = z.extend(campaignVersionInputSchema, {
  commandId: uuidSchema
})
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
  characterId: z.optional(uuidSchema)
})
export const campaignAssignmentResultSchema = z.strictObject({ ok: z.literal(true) })
export const campaignMembershipDepartureResultSchema = z.strictObject({ ok: z.literal(true) })

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
  username: z.string().check(z.trim()).check(z.minLength(3)).check(z.maxLength(30)),
  expiresAt: z.optional(timestampSchema)
})
export const campaignInviteDtoSchema = z.strictObject({
  invitePublicId: uuidSchema,
  listingPublicId: uuidSchema,
  listingTitle: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)),
  hostProfilePublicId: uuidSchema,
  hostUsername: z.string().check(z.trim()).check(z.minLength(3)).check(z.maxLength(30)),
  recipientUsername: z.string().check(z.trim()).check(z.minLength(3)).check(z.maxLength(30)),
  status: campaignInviteStatusDtoSchema,
  expiresAt: timestampSchema,
  respondedAt: z.nullable(timestampSchema),
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
export const campaignOwnershipTransferRequestResultSchema = z.strictObject({ ok: z.literal(true) })

export const campaignContentShareDtoSchema = z.strictObject({
  subjectKind: authoredSubjectKindSchema,
  subjectId: uuidSchema,
  document: jsonSchema,
  sharedBy: uuidSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const campaignContentSharesDtoSchema = z.array(campaignContentShareDtoSchema)
export const shareCampaignContentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  subjectKind: authoredSubjectKindSchema,
  subjectId: uuidSchema
})
export const unshareCampaignContentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  subjectKind: authoredSubjectKindSchema,
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
      subjectKind: authoredSubjectKindSchema,
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
  pendingVehicleCleanupIds: z.optional(z.array(uuidSchema)),
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
export type CampaignAssignmentResult = z.infer<typeof campaignAssignmentResultSchema>
export type CampaignFormatDto = z.infer<typeof campaignFormatDtoSchema>
export type CampaignToneTagDto = z.infer<typeof campaignToneTagDtoSchema>
export type CampaignContentMaturityDto = z.infer<typeof campaignContentMaturityDtoSchema>
export type CreateCampaignInput = z.input<typeof createCampaignInputSchema>
export type CopyCampaignInput = z.input<typeof copyCampaignInputSchema>
export type DeleteCampaignInput = z.input<typeof deleteCampaignInputSchema>
export type CampaignDeletionResult = z.output<typeof campaignDeletionResultSchema>
export type CampaignPublicIdInput = z.input<typeof campaignPublicIdInputSchema>
export type UpdateCampaignInput = z.input<typeof updateCampaignInputSchema>
export type CampaignInviteDto = z.infer<typeof campaignInviteDtoSchema>
export type CreateCampaignInviteInput = z.input<typeof createCampaignInviteInputSchema>
export type CampaignInviteVersionInput = z.input<typeof campaignInviteVersionInputSchema>
export type CampaignContentShareDto = z.infer<typeof campaignContentShareDtoSchema>
export type CampaignContentSharesDto = z.infer<typeof campaignContentSharesDtoSchema>
export type ShareCampaignContentInput = z.input<typeof shareCampaignContentInputSchema>
export type UnshareCampaignContentInput = z.input<typeof unshareCampaignContentInputSchema>
export type CampaignContentRemovalReceiptDto = z.infer<
  typeof campaignContentRemovalReceiptDtoSchema
>
