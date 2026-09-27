import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { activeRuleEffectLifecycleDtoSchema } from '../shared/activeRuleEffectLifecycle.js'

export const activeRuleEffectChecksumSchema = lazySchema(() =>
  z.string().check(z.regex(/^[a-f0-9]{64}$/))
)
export const activeRuleEffectTimestampSchema = lazySchema(() => z.iso.datetime())

const activeRuleEffectStoredBaseSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    maintainedEffectStateId: z.nullable(postgresUuidSchema),
    createdOrdinal: z.number().check(z.int()).check(z.positive()),
    version: z.number().check(z.int()).check(z.positive()),
    definitionJson: z.string(),
    definitionChecksum: activeRuleEffectChecksumSchema,
    lifecycle: activeRuleEffectLifecycleDtoSchema,
    lifecycleChecksum: activeRuleEffectChecksumSchema,
    createdAt: activeRuleEffectTimestampSchema,
    updatedAt: activeRuleEffectTimestampSchema
  })
)

export const characterActiveRuleEffectStoredSchema = lazySchema(() =>
  z.extend(activeRuleEffectStoredBaseSchema, {
    characterId: postgresUuidSchema,
    sourceEncounterId: z.nullable(postgresUuidSchema)
  })
)

export const encounterActiveRuleEffectStoredSchema = lazySchema(() =>
  z.extend(activeRuleEffectStoredBaseSchema, {
    encounterId: postgresUuidSchema,
    targetActorId: postgresUuidSchema
  })
)

export const encounterMaintainedEffectStateStoredSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    ownerActorId: postgresUuidSchema,
    maintenanceDefinitionId: postgresUuidSchema,
    descriptorJson: z.string(),
    descriptorChecksum: activeRuleEffectChecksumSchema,
    version: z.number().check(z.int()).check(z.positive()),
    createdAt: activeRuleEffectTimestampSchema,
    updatedAt: activeRuleEffectTimestampSchema
  })
)
