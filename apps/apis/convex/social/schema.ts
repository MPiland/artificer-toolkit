import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialStoredReportSchema,
  socialStoredModerationActionSchema
} from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import {
  socialStoredListingSchema,
  socialStoredProfileSchema,
  socialStoredBlockSchema,
  socialStoredBlockInvalidationSchema,
  socialStoredListingInvalidationSchema,
  socialStoredProfileInvalidationSchema,
  socialStoredRateLimitSchema,
  socialStoredApplicationSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'

export const socialTables = {
  socialProfileInvalidations: defineTable({
    ...zodToConvexFields(socialStoredProfileInvalidationSchema.shape),
    committedAt: v.commitTs()
  })
    .index('by_profileId_generation', ['profileId', 'generation'])
    .index('by_userId_generation', ['userId', 'generation']),
  socialListingInvalidations: defineTable({
    ...zodToConvexFields(socialStoredListingInvalidationSchema.shape),
    committedAt: v.commitTs()
  }).index('by_listingId_generation', ['listingId', 'generation']),
  socialReports: defineTable(zodToConvexFields(socialStoredReportSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_reporterProfileId', ['reporterProfileId'])
    .index('by_targetProfileId', ['targetProfileId'])
    .index('by_targetListingId', ['targetListingId'])
    .index('by_evidenceListingPublicId', ['evidenceSnapshot.listingPublicId'])
    .index('by_targetApplicationId_queuePriority_resolvedAt', [
      'targetApplicationId',
      'queuePriority',
      'resolvedAt'
    ])
    .index('by_queuePriority_createdAt_id', ['queuePriority', 'createdAt', 'id']),
  socialModerationActions: defineTable(zodToConvexFields(socialStoredModerationActionSchema.shape))
    .index('by_moderatorUserId', ['moderatorUserId'])
    .index('by_affectedProfileId', ['affectedProfileId'])
    .index('by_affectedListingId', ['affectedListingId'])
    .index('by_reportId_createdAt_id', ['reportId', 'createdAt', 'id']),
  socialBlocks: defineTable(zodToConvexFields(socialStoredBlockSchema.shape))
    .index('by_blockerProfileId_blockedProfileId', ['blockerProfileId', 'blockedProfileId'])
    .index('by_blockedProfileId_blockerProfileId', ['blockedProfileId', 'blockerProfileId'])
    .index('by_blockerProfileId_createdAt_blockedProfileId', [
      'blockerProfileId',
      'createdAt',
      'blockedProfileId'
    ]),
  socialBlockInvalidations: defineTable({
    ...zodToConvexFields(socialStoredBlockInvalidationSchema.shape),
    committedAt: v.optional(v.commitTs())
  })
    .index('by_firstProfileId_secondProfileId_generation', [
      'firstProfileId',
      'secondProfileId',
      'generation'
    ])
    .index('by_firstProfileId_secondUserId_generation', [
      'firstProfileId',
      'secondUserId',
      'generation'
    ])
    .index('by_secondProfileId_firstUserId_generation', [
      'secondProfileId',
      'firstUserId',
      'generation'
    ])
    .index('by_firstUserId_secondUserId_generation', ['firstUserId', 'secondUserId', 'generation']),
  socialApplications: defineTable(zodToConvexFields(socialStoredApplicationSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_listingId_status', ['listingId', 'status'])
    .index('by_applicantProfileId_status_submittedAt_id', [
      'applicantProfileId',
      'status',
      'submittedAt',
      'id'
    ])
    .index('by_listingId_status_submittedAt_id', ['listingId', 'status', 'submittedAt', 'id'])
    .index('by_listingId_applicantProfileId_status', ['listingId', 'applicantProfileId', 'status']),
  socialActionRateLimits: defineTable(zodToConvexFields(socialStoredRateLimitSchema.shape)).index(
    'by_userId_action_window',
    ['userId', 'action', 'window']
  ),
  socialProfiles: defineTable(zodToConvexFields(socialStoredProfileSchema.shape))
    .index('by_userId', ['userId'])
    .index('by_publicId', ['id']),
  socialListings: defineTable(zodToConvexFields(socialStoredListingSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_campaignId', ['campaignId'])
    .index('by_discovery_publishedAt_id', [
      'status',
      'audience',
      'moderationStatus',
      'publishedAt',
      'id'
    ])
    .index('by_discovery_searchVersion', [
      'status',
      'audience',
      'moderationStatus',
      'search.version'
    ])
    .searchIndex('search_discovery', {
      searchField: 'search.text',
      filterFields: [
        'status',
        'audience',
        'moderationStatus',
        'systemId',
        'playMode',
        'schedule.kind',
        'schedule.timeZone',
        'location.stateCode'
      ]
    })
    .index('by_ownerUserId_audience_status', ['ownerUserId', 'audience', 'status'])
    .index('by_ownerUserId_ownerProfileGeneration_audience_status', [
      'ownerUserId',
      'ownerProfileGeneration',
      'audience',
      'status'
    ])
    .index('by_ownerUserId_updatedAt_id', ['ownerUserId', 'updatedAt', 'id'])
    .index('by_ownerUserId_status_updatedAt_id', ['ownerUserId', 'status', 'updatedAt', 'id'])
}
