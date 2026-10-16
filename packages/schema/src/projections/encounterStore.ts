import type { z } from '../zod.js'
import {
  encounterActorTokenBindingSchema,
  encounterSceneBindingSchema,
  encounterStoredDecisionSkipSchema,
  encounterStoredEvidenceRollSchema,
  encounterStoredReplayIndexSchema,
  encounterStoredPendingSnapshotPartSchema,
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredActorSnapshotSchema,
  encounterStoredRunActorSchema,
  encounterStoredRunCommandSchema,
  encounterStoredSourceProjectionFactsSchema,
  encounterStoredRunSchema,
  encounterStoredTurnMovementSchema
} from './encounterRunPersistence.js'
import {
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema,
  encounterInitiativeSideDtoSchema
} from '../shared/initiativeState.js'
import {
  characterActiveRuleEffectStoredSchema,
  encounterActiveRuleEffectStoredSchema,
  encounterMaintainedEffectStateStoredSchema
} from './activeRuleEffectStorage.js'
import { encounterSpatialRuleEffectStoredSchema } from './spatialRuleEffectPersistence.js'
import {
  campaignStoredAssignmentSchema,
  campaignStoredMembershipSchema,
  campaignStoredRecordSchema
} from './campaignPersistence.js'
import {
  characterStoredCommandReceiptSchema,
  characterStoredPlayStateSchema,
  characterStoredHeadSchema
} from './characterPersistence.js'
import {
  campaignStoredConversationSchema,
  campaignStoredConversationMemberSchema,
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryPayloadSchema
} from './campaignCommunicationPersistence.js'

/**
 * Each store table's stored document schema. The Convex schema defines the same tables from the
 * same schemas; the store interface's types make any drift in names, fields or indexes a
 * compile error where Convex's `ctx.db` is used as the store.
 */
export const encounterStoreSchemas = {
  encounterRuns: encounterStoredRunSchema,
  encounterRunActors: encounterStoredRunActorSchema,
  encounterActorSnapshots: encounterStoredActorSnapshotSchema,
  encounterSourceProjectionFacts: encounterStoredSourceProjectionFactsSchema,
  encounterSceneBindings: encounterSceneBindingSchema,
  encounterActorTokenBindings: encounterActorTokenBindingSchema,
  encounterInitiativeRounds: encounterInitiativeRoundDtoSchema,
  encounterInitiativeParticipants: encounterInitiativeParticipantDtoSchema,
  encounterInitiativeSides: encounterInitiativeSideDtoSchema,
  encounterRunCommands: encounterStoredRunCommandSchema,
  encounterRuleOccurrences: encounterStoredRuleOccurrenceSchema,
  encounterPendingSnapshotParts: encounterStoredPendingSnapshotPartSchema,
  encounterRuleReceipts: encounterStoredRuleReceiptSchema,
  encounterEvidenceRolls: encounterStoredEvidenceRollSchema,
  encounterReplayIndex: encounterStoredReplayIndexSchema,
  encounterTurnMovements: encounterStoredTurnMovementSchema,
  encounterDecisionSkips: encounterStoredDecisionSkipSchema,
  characterActiveRuleEffects: characterActiveRuleEffectStoredSchema,
  encounterActiveRuleEffects: encounterActiveRuleEffectStoredSchema,
  encounterMaintainedEffectStates: encounterMaintainedEffectStateStoredSchema,
  encounterSpatialRuleEffects: encounterSpatialRuleEffectStoredSchema,
  campaigns: campaignStoredRecordSchema,
  campaignMemberships: campaignStoredMembershipSchema,
  campaignCharacterAssignments: campaignStoredAssignmentSchema,
  characters: characterStoredHeadSchema,
  characterPlayStates: characterStoredPlayStateSchema,
  characterCommandReceipts: characterStoredCommandReceiptSchema,
  campaignConversations: campaignStoredConversationSchema,
  campaignConversationMembers: campaignStoredConversationMemberSchema,
  campaignConversationEntries: campaignStoredEntryHeaderSchema,
  campaignConversationEntryPayloads: campaignStoredEntryPayloadSchema
}

export type EncounterStoreDocuments = {
  [Table in keyof typeof encounterStoreSchemas]: z.infer<(typeof encounterStoreSchemas)[Table]>
}

/** Each table's indexes, by name, without the implicit creation-time tiebreaker. */
export const encounterStoreIndexes = {
  encounterRuns: {
    by_publicId: ['id'],
    by_campaignId_status: ['campaignId', 'status'],
    by_campaignId_createdAt_id: ['campaignId', 'createdAt', 'id'],
    by_campaignId_createCommandId: ['campaignId', 'createCommandId']
  },
  encounterRunActors: {
    by_encounterId_id: ['encounterId', 'id'],
    by_encounterId_snapshotChecksum: ['encounterId', 'snapshotChecksum'],
    by_encounterId_formOriginSnapshotChecksum: ['encounterId', 'formOriginSnapshotChecksum'],
    by_encounterId_sourceFactsChecksum: ['encounterId', 'sourceFactsChecksum']
  },
  encounterActorSnapshots: {
    by_encounterId_checksum: ['encounterId', 'checksum']
  },
  encounterSourceProjectionFacts: {
    by_encounterId_checksum: ['encounterId', 'checksum']
  },
  encounterSceneBindings: { by_encounterId: ['encounterId'] },
  encounterActorTokenBindings: {
    by_encounterId_actorId: ['encounterId', 'actorId'],
    by_encounterId_tokenId: ['encounterId', 'tokenId'],
    by_sceneId_tokenId: ['sceneId', 'tokenId']
  },
  encounterInitiativeRounds: { by_encounterId_round: ['encounterId', 'round'] },
  encounterInitiativeParticipants: {
    by_encounterId_round_actorId: ['encounterId', 'round', 'actorId'],
    by_encounterId_actorId_round: ['encounterId', 'actorId', 'round']
  },
  encounterInitiativeSides: {
    by_encounterId_round_sideId: ['encounterId', 'round', 'sideId']
  },
  encounterRunCommands: {
    by_campaignId_commandId: ['campaignId', 'commandId'],
    by_encounterId: ['encounterId'],
    by_encounterId_id: ['encounterId', 'id'],
    by_encounterId_version: ['encounterId', 'version'],
    by_encounterId_visibility_version: ['encounterId', 'visibility', 'version']
  },
  encounterRuleOccurrences: {
    by_publicId: ['id'],
    by_campaignId_rootCommandId: ['campaignId', 'rootCommandId'],
    by_encounterId_state: ['encounterId', 'state']
  },
  encounterPendingSnapshotParts: {
    by_occurrenceId_sequence: ['occurrenceId', 'sequence'],
    by_encounterId: ['encounterId']
  },
  encounterRuleReceipts: {
    by_campaignId_commandId: ['campaignId', 'commandId'],
    by_encounterId_commandId: ['encounterId', 'commandId'],
    by_encounterId_encounterVersion: ['encounterId', 'encounterVersion'],
    by_occurrenceId: ['occurrenceId']
  },
  encounterEvidenceRolls: {
    by_publicId: ['id'],
    by_campaignId_commandId: ['campaignId', 'commandId'],
    by_encounterId: ['encounterId'],
    by_occurrenceId_version_requestId_userId: [
      'occurrenceId',
      'occurrenceVersion',
      'requestId',
      'userId',
      'attempt'
    ]
  },
  encounterReplayIndex: {
    by_campaignId_commandId: ['campaignId', 'commandId'],
    by_encounterId: ['encounterId']
  },
  encounterTurnMovements: {
    by_encounterId_round_turnActorId_actorId: ['encounterId', 'round', 'turnActorId', 'actorId']
  },
  encounterDecisionSkips: {
    by_encounterId_occurrenceId_occurrenceVersion: [
      'encounterId',
      'occurrenceId',
      'occurrenceVersion'
    ]
  },
  characterActiveRuleEffects: {
    by_publicId: ['id'],
    by_characterId_id: ['characterId', 'id'],
    by_characterId_createdOrdinal_id: ['characterId', 'createdOrdinal', 'id'],
    by_state_source_owner_order: [
      'maintainedEffectStateId',
      'sourceEncounterId',
      'characterId',
      'createdOrdinal',
      'id'
    ],
    by_concentrationCaster: ['concentrationCasterCharacterId', 'characterId', 'id']
  },
  encounterActiveRuleEffects: {
    by_publicId: ['id'],
    by_encounterId_targetActorId_id: ['encounterId', 'targetActorId', 'id'],
    by_encounterId_targetActorId_createdOrdinal_id: [
      'encounterId',
      'targetActorId',
      'createdOrdinal',
      'id'
    ],
    by_state_encounter_owner_order: [
      'maintainedEffectStateId',
      'encounterId',
      'targetActorId',
      'createdOrdinal',
      'id'
    ]
  },
  encounterMaintainedEffectStates: {
    by_publicId: ['id'],
    by_encounterId_id: ['encounterId', 'id'],
    by_encounter_owner_definition: ['encounterId', 'ownerActorId', 'maintenanceDefinitionId'],
    by_encounter_owner_definition_order: [
      'encounterId',
      'ownerActorId',
      'maintenanceDefinitionId',
      'id'
    ]
  },
  encounterSpatialRuleEffects: {
    by_publicId: ['id'],
    by_encounterId_sceneId_id: ['encounterId', 'sceneId', 'id'],
    by_encounterId_sceneId_createdOrdinal_id: ['encounterId', 'sceneId', 'createdOrdinal', 'id']
  },
  campaigns: {
    by_publicId: ['id'],
    by_ownerUserId_status: ['ownerUserId', 'status']
  },
  campaignMemberships: {
    by_campaignId_userId: ['campaignId', 'userId'],
    by_campaignId_status: ['campaignId', 'status'],
    by_userId_status_joinedAt: ['userId', 'status', 'joinedAt']
  },
  campaignCharacterAssignments: {
    by_campaignId_userId: ['campaignId', 'userId'],
    by_campaignId: ['campaignId'],
    by_characterId: ['characterId']
  },
  characters: {
    by_publicId: ['id'],
    by_userId: ['userId'],
    by_portraitAssetId: ['portraitAssetId'],
    by_userId_systemId_id: ['userId', 'systemId', 'id']
  },
  characterPlayStates: { by_characterId: ['characterId'] },
  characterCommandReceipts: {
    by_characterId_commandId: ['characterId', 'commandId'],
    by_characterId_occurredAt_id: ['characterId', 'occurredAt', 'id'],
    by_characterId_actorId_occurredAt_id: ['characterId', 'actorId', 'occurredAt', 'id']
  },
  campaignConversations: {
    by_publicId: ['id'],
    by_campaignId_kind: ['campaignId', 'kind'],
    by_campaignId_kind_participants: ['campaignId', 'kind', 'participantUserIds']
  },
  campaignConversationMembers: {
    by_conversationId_userId: ['conversationId', 'userId'],
    by_campaignId: ['campaignId']
  },
  campaignConversationEntries: {
    by_publicId: ['id'],
    by_conversationId_createdAt_id: ['conversationId', 'createdAt', 'id'],
    by_campaignId_authorUserId_clientNonce: ['campaignId', 'authorUserId', 'clientNonce'],
    by_campaignId_authorUserId_createdAt: ['campaignId', 'authorUserId', 'createdAt']
  },
  campaignConversationEntryPayloads: { by_entryId: ['entryId'] }
} as const satisfies {
  [Table in keyof EncounterStoreDocuments]: Record<
    string,
    readonly (keyof EncounterStoreDocuments[Table] & string)[]
  >
}
