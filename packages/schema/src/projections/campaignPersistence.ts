import { z, lazySchema } from '../zod.js'
import {
  campaignCharacterControllerUserIdsSchema,
  campaignDetailDtoSchema,
  campaignRoleDtoSchema,
  campaignInviteDtoSchema
} from '../api/campaignCore.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignStoredRecordSchema = lazySchema(() =>
  z.extend(
    z.omit(campaignDetailDtoSchema, {
      role: true,
      memberCount: true,
      playerCount: true,
      capabilities: true,
      assignedCharacter: true,
      memberships: true,
      rollModes: true
    }),
    { ownerUserId: uuidSchema, notebookRevision: z.optional(uuidSchema) }
  )
)

export const campaignStoredMembershipSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    userId: uuidSchema,
    role: campaignRoleDtoSchema,
    status: z.enum(['ACTIVE', 'LEFT']),
    accessStartedAt: timestampSchema,
    joinedAt: timestampSchema,
    leftAt: z.nullable(timestampSchema)
  })
)

export const campaignStoredAssignmentSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    userId: uuidSchema,
    characterId: uuidSchema,
    assignedAt: timestampSchema,
    /** Players the GM gave control of the Character; absent means none (SCENE-5.1, D162). */
    controllerUserIds: z.optional(campaignCharacterControllerUserIdsSchema)
  })
)

export const campaignStoredOwnershipTransferSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    fromUserId: uuidSchema,
    toUserId: uuidSchema,
    expiresAt: timestampSchema
  })
)

export const campaignStoredInviteSchema = lazySchema(() =>
  z.extend(
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
)
