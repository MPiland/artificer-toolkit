import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { projectionChecksumSchema } from '@artificer-toolkit/schema/projections/identity'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { liveSessionStoredCheckpointFenceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import { liveCharacterHoldSchema } from '@artificer-toolkit/schema/projections/liveCharacterHold'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignStoredAssignmentSchema,
  campaignStoredMembershipSchema,
  campaignStoredRecordSchema,
  campaignStoredOwnershipTransferSchema,
  campaignStoredInviteSchema
} from '@artificer-toolkit/schema/projections/campaignPersistence'
import { campaignPlaySettingsDtoSchema } from '@artificer-toolkit/schema/api/campaignSettings'
import { campaignStoredVehicleSchema } from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { vehicleCleanupTables } from './vehicleCleanupSchema'
import { campaignDeletionJobSchema } from '@artificer-toolkit/schema/projections/campaignDeletion'
import { campaignStoredContentShareSchema } from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import { campaignStoredCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterStatePersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import {
  campaignStoredPartyInventorySchema,
  campaignStoredCurrencySystemSchema,
  campaignStoredCurrencyDenominationSchema,
  campaignStoredPartyItemSchema,
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import {
  campaignClockDtoSchema,
  campaignSessionDtoSchema,
  campaignSessionAttendanceDtoSchema,
  campaignSessionRsvpDtoSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import { campaignStoredNotebookSectionSchema } from '@artificer-toolkit/schema/projections/campaignNotebookPersistence'
import { campaignStoredCopySchema } from '@artificer-toolkit/schema/projections/campaignCopyPersistence'
import {
  campaignStoredCommandSchema,
  campaignStoredSessionReferenceSchema,
  campaignStoredSessionNoteSchema
} from '@artificer-toolkit/schema/projections/campaignSessionPersistence'
import {
  campaignStoredClockRecoveryPromptSchema,
  campaignStoredClockRecoverySchema,
  campaignStoredClockSegmentSchema
} from '@artificer-toolkit/schema/projections/campaignClockPersistence'
import {
  campaignStoredAnnouncementSchema,
  campaignStoredConversationSchema,
  campaignStoredConversationMemberSchema,
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'

export const campaignTables = {
  liveCharacterHolds: defineTable(zodToConvexFields(liveCharacterHoldSchema.shape))
    .index('by_characterId', ['characterId'])
    .index('by_campaignId', ['campaignId'])
    .index('by_campaignId_encounterId', ['campaignId', 'encounterId']),
  campaignDeletionJobs: defineTable({
    ...zodToConvexFields(campaignDeletionJobSchema.shape),
    campaignRootId: v.id('campaigns'),
    liveAuthorityId: v.optional(v.id('campaignLiveAuthorities'))
  }).index('by_campaignId', ['campaignId']),
  ...vehicleCleanupTables,
  campaignLiveAuthorities: defineTable({
    campaignId: zodToConvex(postgresUuidSchema),
    epoch: zodToConvex(postgresUuidSchema),
    phase: v.union(v.literal('ACTIVATING'), v.literal('DO_ACTIVE'), v.literal('DRAINING')),
    activationFingerprint: zodToConvex(projectionChecksumSchema),
    activationExpiresAt: v.optional(v.number()),
    persistedSequence: v.number(),
    persistedStateChecksum: zodToConvex(projectionChecksumSchema),
    lastCheckpoint: v.optional(zodToConvex(liveSessionStoredCheckpointFenceSchema)),
    checkpointedAt: v.optional(v.string()),
    finalSequence: v.optional(v.number()),
    finalStateChecksum: v.optional(zodToConvex(projectionChecksumSchema)),
    createdAt: v.string(),
    updatedAt: v.string()
  }).index('by_campaignId', ['campaignId']),
  campaignContentUsage: defineTable({
    campaignId: zodToConvex(postgresUuidSchema),
    entries: v.number(),
    scenes: v.number()
  }).index('by_campaignId', ['campaignId']),
  campaignCopyJobs: defineTable(zodToConvexFields(campaignStoredCopySchema.shape))
    .index('by_publicId', ['id'])
    .index('by_ownerUserId_commandId', ['ownerUserId', 'command.commandId'])
    .index('by_sourceCampaignId_commandId', ['command.campaignId', 'command.commandId'])
    .index('by_ownerUserId_createdAt_id', ['ownerUserId', 'createdAt', 'id'])
    .index('by_sourceCampaignId_id', ['command.campaignId', 'id']),
  campaignOwnershipTransfers: defineTable(
    zodToConvexFields(campaignStoredOwnershipTransferSchema.shape)
  ).index('by_campaignId', ['campaignId']),
  campaignInvites: defineTable(zodToConvexFields(campaignStoredInviteSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_createdBy_id', ['createdBy', 'id'])
    .index('by_listingId_status', ['listingId', 'status'])
    .index('by_recipientUserId_status_createdAt_id', [
      'recipientUserId',
      'status',
      'createdAt',
      'id'
    ])
    .index('by_listingId_status_createdAt_id', ['listingId', 'status', 'createdAt', 'id'])
    .index('by_listingId_recipientUserId_status', ['listingId', 'recipientUserId', 'status'])
    .index('by_status_expiresAt_id', ['status', 'expiresAt', 'id']),
  campaignVehicles: defineTable(zodToConvexFields(campaignStoredVehicleSchema.shape))
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_vehicleDefinitionId_id', ['campaignId', 'vehicleDefinitionId', 'id'])
    .index('by_campaignId_createdAt_id', ['campaignId', 'createdAt', 'id'])
    .index('by_campaignId_availability_createdAt_id', [
      'campaignId',
      'availability',
      'createdAt',
      'id'
    ]),
  campaignCurrencySystems: defineTable(zodToConvexFields(campaignStoredCurrencySystemSchema.shape))
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_label_id', ['campaignId', 'label', 'id'])
    .index('by_campaignId_isReference', ['campaignId', 'isReference']),
  campaignCurrencyDenominations: defineTable(
    zodToConvexFields(campaignStoredCurrencyDenominationSchema.shape)
  )
    .index('by_publicId', ['id'])
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_systemId_sortOrder', ['campaignId', 'systemId', 'sortOrder']),
  campaignPartyInventories: defineTable(zodToConvexFields(campaignStoredPartyInventorySchema.shape))
    .index('by_campaignId', ['campaignId'])
    .index('by_campaignId_vehicleId', ['campaignId', 'vehicleId']),
  campaignPartyItems: defineTable(zodToConvexFields(campaignStoredPartyItemSchema.shape))
    .index('by_cleanupJobId', ['cleanupJobId'])
    .index('by_equipmentId', ['equipmentId'])
    .index('by_campaignId_equipmentId', ['campaignId', 'equipmentId'])
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_vehicleId_id', ['campaignId', 'vehicleId', 'id'])
    .index('by_campaignId_vehicleId_containerId', ['campaignId', 'vehicleId', 'containerId']),
  campaignPartyCurrencyGroups: defineTable(
    zodToConvexFields(campaignStoredPartyCurrencyGroupSchema.shape)
  )
    .index('by_cleanupJobId', ['cleanupJobId'])
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_vehicleId_id', ['campaignId', 'vehicleId', 'id'])
    .index('by_campaignId_vehicleId_containerId', ['campaignId', 'vehicleId', 'containerId']),
  campaignPartyCurrencies: defineTable(zodToConvexFields(campaignStoredPartyCurrencySchema.shape))
    .index('by_cleanupJobId', ['cleanupJobId'])
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_vehicleId_id', ['campaignId', 'vehicleId', 'id'])
    .index('by_campaignId_vehicleId_containerId', ['campaignId', 'vehicleId', 'containerId'])
    .index('by_campaign_currencySystem_id', ['campaignId', 'campaignCurrencySystemId', 'id'])
    .index('by_owner_system_denomination_id', [
      'campaignId',
      'vehicleId',
      'campaignCurrencySystemId',
      'denominationId',
      'id'
    ])
    .index('by_owner_system_denomination_container', [
      'campaignId',
      'vehicleId',
      'campaignCurrencySystemId',
      'denominationId',
      'groupId',
      'containerId'
    ])
    .index('by_campaignId_vehicleId_groupId_id', ['campaignId', 'vehicleId', 'groupId', 'id']),
  campaignEvents: defineTable(zodToConvexFields(campaignStoredEventSchema.shape))
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_commandId', ['campaignId', 'commandId'])
    .index('by_campaignId_inventoryAudit_createdAt_id', [
      'campaignId',
      'inventoryAudit',
      'createdAt',
      'id'
    ])
    .index('by_campaignId_visibleInHistory_visibility_createdAt_id', [
      'campaignId',
      'visibleInHistory',
      'visibility',
      'createdAt',
      'id'
    ])
    .index('by_campaignId_history_visibility_subject_createdAt_id', [
      'campaignId',
      'visibleInHistory',
      'visibility',
      'subjectCharacterId',
      'createdAt',
      'id'
    ]),
  campaignCharacterStates: defineTable(
    zodToConvexFields(campaignStoredCharacterStateSchema.shape)
  ).index('by_campaignId_characterId', ['campaignId', 'characterId']),
  campaignContentShares: defineTable(zodToConvexFields(campaignStoredContentShareSchema.shape))
    .index('by_campaignId_sharedBy', ['campaignId', 'sharedBy'])
    .index('by_campaignId_subjectKind_subjectId', ['campaignId', 'subjectKind', 'subjectId'])
    .index('by_subjectKind_subjectId_campaignId', ['subjectKind', 'subjectId', 'campaignId']),
  campaignSessionReferences: defineTable(
    zodToConvexFields(campaignStoredSessionReferenceSchema.shape)
  )
    .index('by_campaignId_sessionId_id', ['campaignId', 'sessionId', 'id'])
    .index('by_campaignId_noteSectionId', ['campaignId', 'target.noteSectionId'])
    .index('by_campaignId_sessionId_createdAt_id', ['campaignId', 'sessionId', 'createdAt', 'id']),
  campaignCommands: defineTable(zodToConvex(campaignStoredCommandSchema)).index(
    'by_campaignId_commandId',
    ['campaignId', 'commandId']
  ),
  campaignClocks: defineTable(zodToConvexFields(campaignClockDtoSchema.shape)).index(
    'by_campaignId',
    ['campaignId']
  ),
  campaignClockSegments: defineTable(zodToConvexFields(campaignStoredClockSegmentSchema.shape))
    .index('by_campaignId_startedAt_id', ['campaignId', 'startedAt', 'id'])
    .index('by_campaignId_stoppedAt', ['campaignId', 'stoppedAt']),
  campaignClockRecoveries: defineTable(zodToConvexFields(campaignStoredClockRecoverySchema.shape))
    .index('by_campaignId_boundary_character_resource', [
      'campaignId',
      'boundaryAbsoluteMinute',
      'characterId',
      'resourceKey'
    ])
    .index('by_campaignId_boundary', ['campaignId', 'boundaryAbsoluteMinute']),
  campaignClockRecoveryPrompts: defineTable(
    zodToConvexFields(campaignStoredClockRecoveryPromptSchema.shape)
  )
    .index('by_campaignId_boundary_character_kind', [
      'campaignId',
      'boundaryAbsoluteMinute',
      'characterId',
      'boundaryKind'
    ])
    .index('by_campaignId_characterId', ['campaignId', 'characterId'])
    .index('by_campaignId_id', ['campaignId', 'id']),
  campaignSessionNotes: defineTable(zodToConvexFields(campaignStoredSessionNoteSchema.shape))
    .index('by_campaignId_sessionId_id', ['campaignId', 'sessionId', 'id'])
    .index('by_campaignId_sessionId_sortOrder_id', ['campaignId', 'sessionId', 'sortOrder', 'id']),
  campaignSessions: defineTable(zodToConvexFields(campaignSessionDtoSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_sessionNumber', ['campaignId', 'sessionNumber'])
    .index('by_campaignId_status_sessionNumber', ['campaignId', 'status', 'sessionNumber']),
  campaignSessionAttendance: defineTable(
    zodToConvexFields(campaignSessionAttendanceDtoSchema.shape)
  )
    .index('by_campaignId_sessionId_characterId', ['campaignId', 'sessionId', 'characterId'])
    .index('by_campaignId_sessionId_present_characterId', [
      'campaignId',
      'sessionId',
      'present',
      'characterId'
    ]),
  campaignSessionRsvps: defineTable(zodToConvexFields(campaignSessionRsvpDtoSchema.shape))
    .index('by_campaignId_sessionId_userId', ['campaignId', 'sessionId', 'userId'])
    .index('by_campaignId_sessionId_updatedAt_userId', [
      'campaignId',
      'sessionId',
      'updatedAt',
      'userId'
    ]),
  campaignNotebookSections: defineTable(
    zodToConvexFields(campaignStoredNotebookSectionSchema.shape)
  )
    .index('by_campaignId_id', ['campaignId', 'id'])
    .index('by_campaignId_authorUserId_category_id', [
      'campaignId',
      'authorUserId',
      'category',
      'id'
    ])
    .index('by_campaignId_sortOrder_id', ['campaignId', 'sortOrder', 'id']),
  campaignConversations: defineTable(zodToConvexFields(campaignStoredConversationSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_campaignId_kind', ['campaignId', 'kind'])
    .index('by_campaignId_kind_participants', ['campaignId', 'kind', 'participantUserIds']),
  campaignConversationMembers: defineTable(
    zodToConvexFields(campaignStoredConversationMemberSchema.shape)
  )
    .index('by_conversationId_userId', ['conversationId', 'userId'])
    .index('by_campaignId', ['campaignId']),
  campaignConversationEntries: defineTable(zodToConvexFields(campaignStoredEntryHeaderSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_conversationId_createdAt_id', ['conversationId', 'createdAt', 'id'])
    .index('by_campaignId_authorUserId_clientNonce', ['campaignId', 'authorUserId', 'clientNonce'])
    .index('by_campaignId_authorUserId_createdAt', ['campaignId', 'authorUserId', 'createdAt']),
  campaignConversationEntryPayloads: defineTable(
    zodToConvexFields(campaignStoredEntryPayloadSchema.shape)
  )
    .index('by_entryId', ['entryId'])
    .index('by_rollId', ['roll.id']),
  campaignAnnouncements: defineTable(zodToConvexFields(campaignStoredAnnouncementSchema.shape))
    .index('by_campaignId_publicId', ['campaignId', 'announcementPublicId'])
    .index('by_campaignId_commandId', ['campaignId', 'commandId'])
    .index('by_campaignId_createdAt_publicId', ['campaignId', 'createdAt', 'announcementPublicId'])
    .index('by_campaignId_scope_createdAt_publicId', [
      'campaignId',
      'scope',
      'createdAt',
      'announcementPublicId'
    ]),
  campaigns: defineTable(zodToConvexFields(campaignStoredRecordSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_ownerUserId_status', ['ownerUserId', 'status']),
  campaignMemberships: defineTable(zodToConvexFields(campaignStoredMembershipSchema.shape))
    .index('by_campaignId_userId', ['campaignId', 'userId'])
    .index('by_campaignId_status', ['campaignId', 'status'])
    .index('by_userId_status_joinedAt', ['userId', 'status', 'joinedAt']),
  campaignCharacterAssignments: defineTable(zodToConvexFields(campaignStoredAssignmentSchema.shape))
    .index('by_campaignId_userId', ['campaignId', 'userId'])
    .index('by_campaignId', ['campaignId'])
    .index('by_characterId', ['characterId']),
  campaignPlaySettings: defineTable(zodToConvexFields(campaignPlaySettingsDtoSchema.shape)).index(
    'by_campaignId',
    ['campaignId']
  )
}
