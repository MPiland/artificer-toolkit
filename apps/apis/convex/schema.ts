import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { vEmailId } from '@convex-dev/resend'
import { notificationStoredIntentSchema } from '@artificer-toolkit/schema/projections/notificationPersistence'
import { entitlementTierDtoSchema } from '@artificer-toolkit/schema/api/accountEntitlements'
import {
  accountUsageResourceSchema,
  accountUsageSchema
} from '@artificer-toolkit/schema/projections/accountUsage'
import {
  gmCampaignRollDtoSchema,
  rollRecordDtoSchema,
  rollVisibilityDtoSchema
} from '@artificer-toolkit/schema/api/rolls'
import {
  notificationFeedItemDtoSchema,
  notificationPreferencesDtoSchema
} from '@artificer-toolkit/schema/api/notifications'

import { buildContentTables } from './content/schema'
import { characterTables } from './characters/schema'
import { campaignTables } from './campaigns/schema'
import { socialTables } from './social/schema'
import { encounterTables } from './encounters/schema'
import { sceneTables } from './scenes/schema'
import { ruleEffectTables } from './rules/schema'
import { importTables } from './imports/schema'
import { normalizedImageCropSchema } from '@artificer-toolkit/schema/api/media'
import { contentSnapshotTables } from './contentSnapshots/schema'
import { receiptLedgerTables } from './lib/receiptLedgerSchema'
import { mediaStoredAssetSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'

export default defineSchema({
  accountEntitlements: defineTable({
    userId: v.string(),
    tier: zodToConvex(entitlementTierDtoSchema)
  }).index('by_userId', ['userId']),
  userProfiles: defineTable({
    userId: v.string(),
    authUserId: v.string(),
    bio: v.union(v.null(), v.string()),
    registrationCompleted: v.optional(v.boolean()),
    notificationPreferences: v.optional(zodToConvex(notificationPreferencesDtoSchema)),
    avatarAssetId: v.optional(v.string()),
    avatarRevision: v.optional(v.number()),
    avatarCrop: v.optional(zodToConvex(normalizedImageCropSchema)),
    /** Absent means PRIVATE, the default; see `readProfileVisibility`. */
    profileVisibility: v.optional(v.union(v.literal('PRIVATE'), v.literal('PUBLIC'))),
    mediaBytes: v.optional(v.number()),
    entitlementUsage: zodToConvex(accountUsageSchema),
    entitlementUsageReady: v.boolean(),
    authoringExperience: v.optional(v.union(v.literal('guided'), v.literal('advanced'))),
    autoRollDice: v.boolean(),
    gmRollVisibility: zodToConvex(rollVisibilityDtoSchema)
  })
    .index('by_authUserId', ['authUserId'])
    .index('by_userId', ['userId']),
  accountUsageEntries: defineTable({
    resource: zodToConvex(accountUsageResourceSchema),
    sourceId: v.string(),
    ownerUserId: v.string(),
    importJobId: v.optional(v.string())
  })
    .index('by_importJobId_sourceId', ['importJobId', 'sourceId'])
    .index('by_resource_sourceId', ['resource', 'sourceId'])
    .index('by_ownerUserId', ['ownerUserId']),
  notificationFeedItems: defineTable({
    ...zodToConvexFields(notificationFeedItemDtoSchema.shape),
    userId: v.string()
  })
    .index('by_userId_occurredAt_id', ['userId', 'occurredAt', 'id'])
    .index('by_userId_id', ['userId', 'id']),
  notificationDeliveryIntents: defineTable({
    ...zodToConvexFields(notificationStoredIntentSchema.shape),
    providerEmailId: v.union(v.null(), vEmailId)
  })
    .index('by_recipientUserId_workflowKey_sourcePublicId', [
      'recipientUserId',
      'workflowKey',
      'sourcePublicId'
    ])
    .index('by_recipientUserId', ['recipientUserId'])
    .index('by_sourcePublicId_workflowKey', ['sourcePublicId', 'workflowKey'])
    .index('by_status_nextAttemptAt', ['status', 'nextAttemptAt']),
  userRollHistory: defineTable({
    ...zodToConvexFields(rollRecordDtoSchema.shape),
    userId: v.string(),
    consumedAt: v.union(v.string(), v.null()),
    gmCampaignRoll: v.union(zodToConvex(gmCampaignRollDtoSchema), v.null())
  })
    .index('by_userId_createdAt_id', ['userId', 'createdAt', 'id'])
    .index('by_userId_id', ['userId', 'id']),
  mediaAssets: defineTable(
    v.union(zodToConvex(mediaStoredAssetSchema), zodToConvex(vttMapStoredAssetSchema))
  )
    .index('by_publicId', ['id'])
    .index('by_ownerUserId_idempotencyKey', ['ownerUserId', 'upload.idempotencyKey'])
    .index('by_ownerUserId', ['ownerUserId'])
    .index('by_ownerUserId_profileClass_hasSceneReferences', [
      'ownerUserId',
      'profileClass',
      'hasSceneReferences'
    ])
    .index('by_ownerUserId_profileClass_contentHash_status', [
      'ownerUserId',
      'profileClass',
      'contentHash',
      'status'
    ])
    .index('by_ownerUserId_profileClass_status', ['ownerUserId', 'profileClass', 'status'])
    .index('by_storageAssetId', ['storageAssetId']),
  ...buildContentTables(),
  ...characterTables,
  ...campaignTables,
  ...socialTables,
  ...encounterTables,
  ...sceneTables,
  ...ruleEffectTables,
  ...importTables,
  ...contentSnapshotTables,
  ...receiptLedgerTables
})
