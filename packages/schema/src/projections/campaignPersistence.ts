import { z } from '../zod.js'
import {
  campaignDetailDtoSchema,
  campaignRoleDtoSchema,
  campaignInviteDtoSchema
} from '../api/campaignCore.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignStoredRecordSchema = z.extend(
  z.omit(campaignDetailDtoSchema, {
    role: true,
    memberCount: true,
    playerCount: true,
    capabilities: true,
    assignedCharacter: true,
    memberships: true
  }),
  { ownerUserId: uuidSchema, notebookRevision: z.optional(uuidSchema) }
)

export const campaignStoredMembershipSchema = z.strictObject({
  campaignId: uuidSchema,
  userId: uuidSchema,
  role: campaignRoleDtoSchema,
  status: z.enum(['ACTIVE', 'LEFT']),
  accessStartedAt: timestampSchema,
  joinedAt: timestampSchema,
  leftAt: z.nullable(timestampSchema)
})

export const campaignStoredAssignmentSchema = z.strictObject({
  campaignId: uuidSchema,
  userId: uuidSchema,
  characterId: uuidSchema,
  assignedAt: timestampSchema
})

export const campaignStoredOwnershipTransferSchema = z.strictObject({
  campaignId: uuidSchema,
  fromUserId: uuidSchema,
  toUserId: uuidSchema,
  expiresAt: timestampSchema
})

export const campaignStoredInviteSchema = z.extend(
  z.omit(campaignInviteDtoSchema, {
    invitePublicId: true,
    listingPublicId: true,
    listingTitle: true,
    hostProfilePublicId: true,
    hostUsername: true
  }),
  {
    id: uuidSchema,
    listingId: uuidSchema,
    createdBy: uuidSchema,
    recipientUserId: uuidSchema,
    listingVersion: z.number().check(z.int()).check(z.nonnegative()),
    revokedAt: z.nullable(timestampSchema),
    expiredAt: z.nullable(timestampSchema),
    blockGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    listingGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    ownerProfileGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    participantProfileGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    updatedAt: timestampSchema
  }
)
