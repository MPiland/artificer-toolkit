import { defineTable } from 'convex/server'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  encounterStoredBlueprintSchema,
  encounterStoredBlueprintUpdateSchema
} from '@artificer-toolkit/schema/projections/encounterBlueprintPersistence'
import {
  encounterStoredRunSchema,
  encounterStoredRunActorSchema,
  encounterStoredActorProjectionFactsSchema,
  encounterStoredSourceProjectionFactsSchema,
  encounterSceneBindingSchema,
  encounterActorTokenBindingSchema,
  encounterStoredRunCommandSchema,
  encounterStoredRuleOccurrenceSchema,
  encounterStoredPendingSnapshotPartSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredEvidenceRollSchema,
  encounterStoredTurnMovementSchema,
  encounterStoredDecisionSkipSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema,
  encounterInitiativeSideDtoSchema
} from '@artificer-toolkit/schema/shared/initiativeState'

export const encounterTables = {
  encounterRuns: defineTable(zodToConvexFields(encounterStoredRunSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_campaignId_status', ['campaignId', 'status'])
    .index('by_campaignId_createdAt_id', ['campaignId', 'createdAt', 'id']),
  encounterRunActors: defineTable(zodToConvexFields(encounterStoredRunActorSchema.shape)).index(
    'by_encounterId_id',
    ['encounterId', 'id']
  ),
  encounterActorProjectionFacts: defineTable(
    zodToConvexFields(encounterStoredActorProjectionFactsSchema.shape)
  )
    .index('by_encounterId_id', ['encounterId', 'id'])
    .index('by_encounterId_sourceFactsChecksum', ['encounterId', 'sourceFactsChecksum']),
  encounterSourceProjectionFacts: defineTable(
    zodToConvexFields(encounterStoredSourceProjectionFactsSchema.shape)
  ).index('by_encounterId_checksum', ['encounterId', 'checksum']),
  encounterSceneBindings: defineTable(zodToConvexFields(encounterSceneBindingSchema.shape))
    .index('by_encounterId', ['encounterId'])
    .index('by_sceneId', ['sceneId']),
  encounterActorTokenBindings: defineTable(
    zodToConvexFields(encounterActorTokenBindingSchema.shape)
  )
    .index('by_encounterId_actorId', ['encounterId', 'actorId'])
    .index('by_encounterId_tokenId', ['encounterId', 'tokenId'])
    .index('by_sceneId_tokenId', ['sceneId', 'tokenId']),
  encounterInitiativeRounds: defineTable(
    zodToConvexFields(encounterInitiativeRoundDtoSchema.shape)
  ).index('by_encounterId_round', ['encounterId', 'round']),
  encounterInitiativeParticipants: defineTable(
    zodToConvexFields(encounterInitiativeParticipantDtoSchema.shape)
  )
    .index('by_encounterId_round_actorId', ['encounterId', 'round', 'actorId'])
    .index('by_encounterId_actorId_round', ['encounterId', 'actorId', 'round']),
  encounterInitiativeSides: defineTable(
    zodToConvexFields(encounterInitiativeSideDtoSchema.shape)
  ).index('by_encounterId_round_sideId', ['encounterId', 'round', 'sideId']),
  encounterRunCommands: defineTable(zodToConvex(encounterStoredRunCommandSchema))
    .index('by_campaignId_commandId', ['campaignId', 'commandId'])
    .index('by_encounterId', ['encounterId'])
    .index('by_encounterId_id', ['encounterId', 'id'])
    .index('by_encounterId_version', ['encounterId', 'version'])
    .index('by_encounterId_visibility_version', ['encounterId', 'visibility', 'version']),
  encounterRuleOccurrences: defineTable(
    zodToConvexFields(encounterStoredRuleOccurrenceSchema.shape)
  )
    .index('by_publicId', ['id'])
    .index('by_campaignId_rootCommandId', ['campaignId', 'rootCommandId'])
    .index('by_encounterId_state', ['encounterId', 'state']),
  encounterPendingSnapshotParts: defineTable(
    zodToConvexFields(encounterStoredPendingSnapshotPartSchema.shape)
  )
    .index('by_occurrenceId_sequence', ['occurrenceId', 'sequence'])
    .index('by_encounterId', ['encounterId']),
  encounterRuleReceipts: defineTable(zodToConvexFields(encounterStoredRuleReceiptSchema.shape))
    .index('by_campaignId_commandId', ['campaignId', 'commandId'])
    .index('by_encounterId_commandId', ['encounterId', 'commandId'])
    .index('by_encounterId_encounterVersion', ['encounterId', 'encounterVersion'])
    .index('by_occurrenceId', ['occurrenceId']),
  encounterEvidenceRolls: defineTable(zodToConvexFields(encounterStoredEvidenceRollSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_campaignId_commandId', ['campaignId', 'commandId'])
    .index('by_encounterId', ['encounterId'])
    .index('by_occurrenceId_version_requestId_userId', [
      'occurrenceId',
      'occurrenceVersion',
      'requestId',
      'userId',
      'attempt'
    ]),
  encounterTurnMovements: defineTable(
    zodToConvexFields(encounterStoredTurnMovementSchema.shape)
  ).index('by_encounterId_round_turnActorId_actorId', [
    'encounterId',
    'round',
    'turnActorId',
    'actorId'
  ]),
  encounterDecisionSkips: defineTable(
    zodToConvexFields(encounterStoredDecisionSkipSchema.shape)
  ).index('by_encounterId_occurrenceId_occurrenceVersion', [
    'encounterId',
    'occurrenceId',
    'occurrenceVersion'
  ]),
  encounterBlueprints: defineTable(zodToConvexFields(encounterStoredBlueprintSchema.shape))
    .index('by_publicId', ['id'])
    .index('by_ownerUserId_commandId', ['ownerUserId', 'commandId'])
    .index('by_ownerUserId_gameSystemId_createdAt_id', [
      'ownerUserId',
      'gameSystemId',
      'createdAt',
      'id'
    ]),
  encounterBlueprintUpdates: defineTable(
    zodToConvexFields(encounterStoredBlueprintUpdateSchema.shape)
  )
    .index('by_ownerUserId_commandId', ['ownerUserId', 'commandId'])
    .index('by_blueprintId', ['blueprintId'])
}
