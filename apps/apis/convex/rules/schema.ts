import { defineTable } from 'convex/server'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterActiveRuleEffectStoredSchema,
  encounterActiveRuleEffectStoredSchema,
  encounterMaintainedEffectStateStoredSchema
} from '@artificer-toolkit/schema/projections/activeRuleEffectStorage'
import { encounterSpatialRuleEffectStoredSchema } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'

export const ruleEffectTables = {
  characterActiveRuleEffects: defineTable(
    zodToConvexFields(characterActiveRuleEffectStoredSchema.shape)
  )
    .index('by_publicId', ['id'])
    .index('by_characterId_id', ['characterId', 'id'])
    .index('by_characterId_createdOrdinal_id', ['characterId', 'createdOrdinal', 'id'])
    .index('by_state_source_owner_order', [
      'maintainedEffectStateId',
      'sourceEncounterId',
      'characterId',
      'createdOrdinal',
      'id'
    ]),
  encounterActiveRuleEffects: defineTable(
    zodToConvexFields(encounterActiveRuleEffectStoredSchema.shape)
  )
    .index('by_publicId', ['id'])
    .index('by_encounterId_targetActorId_id', ['encounterId', 'targetActorId', 'id'])
    .index('by_encounterId_targetActorId_createdOrdinal_id', [
      'encounterId',
      'targetActorId',
      'createdOrdinal',
      'id'
    ])
    .index('by_state_encounter_owner_order', [
      'maintainedEffectStateId',
      'encounterId',
      'targetActorId',
      'createdOrdinal',
      'id'
    ]),
  encounterMaintainedEffectStates: defineTable(
    zodToConvexFields(encounterMaintainedEffectStateStoredSchema.shape)
  )
    .index('by_publicId', ['id'])
    .index('by_encounterId_id', ['encounterId', 'id'])
    .index('by_encounter_owner_definition', [
      'encounterId',
      'ownerActorId',
      'maintenanceDefinitionId'
    ])
    .index('by_encounter_owner_definition_order', [
      'encounterId',
      'ownerActorId',
      'maintenanceDefinitionId',
      'id'
    ]),
  encounterSpatialRuleEffects: defineTable(
    zodToConvexFields(encounterSpatialRuleEffectStoredSchema.shape)
  )
    .index('by_publicId', ['id'])
    .index('by_encounterId_sceneId_id', ['encounterId', 'sceneId', 'id'])
    .index('by_encounterId_sceneId_createdOrdinal_id', [
      'encounterId',
      'sceneId',
      'createdOrdinal',
      'id'
    ])
}
