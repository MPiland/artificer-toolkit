import { z } from '../zod.js'
import {
  createSocialListingInputSchema,
  socialContentPreferenceDtoSchema,
  socialProfileStatusDtoSchema,
  socialListingStatusDtoSchema,
  socialListingModerationStatusDtoSchema,
  socialApplicationDtoSchema,
  socialListingExpectationsDtoSchema
} from '../api/socialHub.js'
import { timestampSchema, uuidSchema, versionSchema } from '../api/campaignContractSchemas.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const socialStoredProfileSchema = z
  .strictObject({
    id: uuidSchema,
    userId: uuidSchema,
    adultAttestedAt: z.nullable(timestampSchema),
    contentPreference: socialContentPreferenceDtoSchema,
    status: socialProfileStatusDtoSchema,
    invalidationGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    version: versionSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
  .check(
    z.refine(
      (profile) => profile.contentPreference !== 'MATURE' || profile.adultAttestedAt !== null,
      {
        message: 'Mature preference requires an adult attestation.'
      }
    )
  )

export type SocialStoredProfile = z.infer<typeof socialStoredProfileSchema>

export const socialStoredBlockSchema = z
  .strictObject({
    blockerProfileId: postgresUuidSchema,
    blockedProfileId: postgresUuidSchema,
    createdAt: timestampSchema,
    invalidationGeneration: z.optional(z.number().check(z.int()).check(z.positive()))
  })
  .check(
    z.refine((block) => block.blockerProfileId !== block.blockedProfileId, {
      message: 'A Social profile cannot block itself.'
    })
  )

export const socialStoredBlockInvalidationSchema = z
  .strictObject({
    firstProfileId: postgresUuidSchema,
    secondProfileId: postgresUuidSchema,
    firstUserId: postgresUuidSchema,
    secondUserId: postgresUuidSchema,
    generation: z.number().check(z.int()).check(z.positive()),
    invalidatedAt: timestampSchema,
    committedAt: z.optional(z.bigint())
  })
  .check(
    z.refine(
      (record) =>
        record.firstProfileId < record.secondProfileId &&
        record.firstUserId !== record.secondUserId,
      { message: 'Social block invalidation pair is invalid.' }
    )
  )

export const socialStoredListingSchema = z.safeExtend(createSocialListingInputSchema, {
  // Optional until the bounded backfill completes; search rejects incomplete public cohorts.
  search: z.optional(z.strictObject({ version: z.literal(1), text: z.string() })),
  id: uuidSchema,
  ownerUserId: uuidSchema,
  ownerProfileGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
  status: socialListingStatusDtoSchema,
  moderationStatus: socialListingModerationStatusDtoSchema,
  publishedAt: z.nullable(timestampSchema),
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})

export type SocialStoredListing = z.infer<typeof socialStoredListingSchema>

export const socialStoredListingInvalidationSchema = z.strictObject({
  listingId: uuidSchema,
  generation: z.number().check(z.int()).check(z.positive()),
  invalidatedAt: timestampSchema,
  committedAt: z.optional(z.bigint())
})

export const socialStoredProfileInvalidationSchema = z.strictObject({
  profileId: uuidSchema,
  userId: uuidSchema,
  generation: z.number().check(z.int()).check(z.positive()),
  invalidatedAt: timestampSchema,
  committedAt: z.optional(z.bigint())
})

export const socialStoredApplicationSchema = z.extend(
  z.omit(socialApplicationDtoSchema, {
    applicationPublicId: true,
    listingPublicId: true,
    listingTitle: true,
    applicant: true,
    expectations: true
  }),
  {
    id: uuidSchema,
    listingId: uuidSchema,
    applicantProfileId: uuidSchema,
    expectationsSnapshot: socialListingExpectationsDtoSchema,
    applicantDeletedAt: z.optional(timestampSchema),
    withdrawnAt: z.nullable(timestampSchema),
    expiredAt: z.nullable(timestampSchema),
    blockedAt: z.nullable(timestampSchema),
    blockGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    listingGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    ownerProfileGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    participantProfileGeneration: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  }
)

export const socialStoredRateLimitSchema = z.strictObject({
  userId: uuidSchema,
  action: z.enum(['APPLICATION', 'INVITE', 'REPORT', 'BLOCK']),
  window: z.enum(['HOUR', 'DAY']),
  windowStartedAt: timestampSchema,
  count: z.number().check(z.int()).check(z.gte(1))
})
