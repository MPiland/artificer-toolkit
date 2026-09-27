import { z, lazySchema } from '../zod.js'

import {
  activeRuleEffectDefinitionDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema
} from '../shared/activeRuleEffects.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { activeRuleEffectLifecycleDtoSchema } from '../shared/activeRuleEffectLifecycle.js'
import {
  activeRuleEffectChecksumSchema,
  activeRuleEffectTimestampSchema
} from './activeRuleEffectStorage.js'

export {
  characterActiveRuleEffectStoredSchema,
  encounterActiveRuleEffectStoredSchema,
  encounterMaintainedEffectStateStoredSchema
} from './activeRuleEffectStorage.js'

export const activeRuleEffectOwnerSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('CHARACTER'), characterId: postgresUuidSchema }),
    z.strictObject({
      kind: z.literal('ENCOUNTER_ACTOR'),
      encounterId: postgresUuidSchema,
      targetActorId: postgresUuidSchema
    })
  ])
)

export const activeRuleEffectRecordSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    owner: activeRuleEffectOwnerSchema,
    sourceEncounterId: z.nullable(postgresUuidSchema),
    maintainedEffectStateId: z.nullable(postgresUuidSchema),
    createdOrdinal: z.number().check(z.int()).check(z.positive()),
    version: z.number().check(z.int()).check(z.positive()),
    definition: activeRuleEffectDefinitionDtoSchema,
    definitionChecksum: activeRuleEffectChecksumSchema,
    lifecycle: activeRuleEffectLifecycleDtoSchema,
    lifecycleChecksum: activeRuleEffectChecksumSchema,
    createdAt: activeRuleEffectTimestampSchema,
    updatedAt: activeRuleEffectTimestampSchema
  })
)

export const encounterMaintainedEffectStateRecordSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    ownerActorId: postgresUuidSchema,
    maintenanceDefinitionId: postgresUuidSchema,
    descriptor: encounterMaintainedEffectDescriptorDtoSchema,
    descriptorChecksum: activeRuleEffectChecksumSchema,
    version: z.number().check(z.int()).check(z.positive()),
    createdAt: activeRuleEffectTimestampSchema,
    updatedAt: activeRuleEffectTimestampSchema
  })
)

export type ActiveRuleEffectOwner = z.infer<typeof activeRuleEffectOwnerSchema>
export type ActiveRuleEffectRecord = z.infer<typeof activeRuleEffectRecordSchema>
export type EncounterMaintainedEffectStateRecord = z.infer<
  typeof encounterMaintainedEffectStateRecordSchema
>
