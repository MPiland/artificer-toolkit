import { z } from '../zod.js'
import { encounterGmActorDtoSchema, encounterGmProjectionDtoSchema } from '../api/encounterData.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterInitiativePolicySnapshotDtoSchema } from '../shared/initiativePolicySnapshot.js'
import { encounterOptionalCombatSnapshotDtoSchema } from '../shared/optionalCombat.js'
import { jsonValueSchema, projectionChecksumSchema } from './identity.js'

export const encounterRunActorStateSchema = z.extend(
  z.omit(encounterGmActorDtoSchema, { statBlock: true, features: true, healthBand: true }),
  {
    sideId: postgresUuidSchema,
    snapshot: jsonValueSchema,
    conditions: jsonValueSchema,
    resources: jsonValueSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  }
)

export const encounterRunStateSchema = z.extend(
  z.omit(encounterGmProjectionDtoSchema, {
    actors: true,
    initiativePolicy: true,
    optionalCombatRules: true
  }),
  {
    rulePackRevisionId: z.null(),
    actorIds: z.array(postgresUuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    initiativePolicySnapshot: z.nullable(encounterInitiativePolicySnapshotDtoSchema),
    initiativePolicySnapshotChecksum: z.nullable(projectionChecksumSchema),
    optionalCombatSnapshot: encounterOptionalCombatSnapshotDtoSchema,
    optionalCombatSnapshotChecksum: projectionChecksumSchema,
    sides: z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          label: z.string(),
          sortOrder: z.number().check(z.int()).check(z.nonnegative())
        })
      )
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    sideRelationships: z
      .array(
        z.strictObject({
          firstSideId: postgresUuidSchema,
          secondSideId: postgresUuidSchema,
          relationshipKind: z.enum(['ALLIED', 'NEUTRAL', 'HOSTILE'])
        })
      )
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
  }
)

export type EncounterRunActorState = z.infer<typeof encounterRunActorStateSchema>
export type EncounterRunState = z.infer<typeof encounterRunStateSchema>
