import { z, lazySchema } from '../zod.js'

import {
  activeRuleEffectDefinitionDtoSchema,
  activeRuleEffectLifecycleDtoSchema
} from '../shared/activeRuleEffects.js'
import {
  spatialRuleEffectPlacementDtoSchema,
  spatialRuleEffectStateDtoSchema
} from '../shared/spatial.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  activeRuleEffectChecksumSchema,
  activeRuleEffectTimestampSchema
} from './activeRuleEffectStorage.js'

export const encounterSpatialRuleEffectStoredSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    createdOrdinal: z.number().check(z.int()).check(z.positive()),
    version: z.number().check(z.int()).check(z.positive()),
    definitionJson: z.string(),
    definitionChecksum: activeRuleEffectChecksumSchema,
    lifecycle: activeRuleEffectLifecycleDtoSchema,
    lifecycleChecksum: activeRuleEffectChecksumSchema,
    placement: spatialRuleEffectPlacementDtoSchema,
    placementChecksum: activeRuleEffectChecksumSchema,
    spatialState: spatialRuleEffectStateDtoSchema,
    spatialStateChecksum: activeRuleEffectChecksumSchema,
    createdAt: activeRuleEffectTimestampSchema,
    updatedAt: activeRuleEffectTimestampSchema
  })
)

export const encounterSpatialRuleEffectRecordSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    createdOrdinal: z.number().check(z.int()).check(z.positive()),
    version: z.number().check(z.int()).check(z.positive()),
    definition: activeRuleEffectDefinitionDtoSchema,
    definitionChecksum: activeRuleEffectChecksumSchema,
    lifecycle: activeRuleEffectLifecycleDtoSchema,
    lifecycleChecksum: activeRuleEffectChecksumSchema,
    placement: spatialRuleEffectPlacementDtoSchema,
    placementChecksum: activeRuleEffectChecksumSchema,
    spatialState: spatialRuleEffectStateDtoSchema,
    spatialStateChecksum: activeRuleEffectChecksumSchema,
    createdAt: activeRuleEffectTimestampSchema,
    updatedAt: activeRuleEffectTimestampSchema
  })
)
export type EncounterSpatialRuleEffectRecord = z.infer<
  typeof encounterSpatialRuleEffectRecordSchema
>
