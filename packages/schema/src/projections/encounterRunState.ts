import { z } from '../zod.js'
import { encounterGmActorDtoSchema, encounterGmProjectionDtoSchema } from '../api/encounterData.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { encounterInitiativePolicySnapshotDtoSchema } from '../shared/initiativePolicySnapshot.js'
import { encounterOptionalCombatSnapshotDtoSchema } from '../shared/optionalCombat.js'
import { jsonValueSchema, projectionChecksumSchema } from './identity.js'

const encounterRunActorStateBaseSchema = z.extend(
  z.omit(encounterGmActorDtoSchema, {
    statBlock: true,
    features: true,
    healthBand: true,
    kind: true,
    sourceId: true,
    sourceRevision: true,
    currentHitPoints: true,
    maxHitPoints: true,
    tempHitPoints: true,
    conditions: true
  }),
  {
    sideId: postgresUuidSchema,
    snapshot: jsonValueSchema,
    resources: jsonValueSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  }
)

/**
 * A Character actor keeps no hit point, condition or stream-version copy: Encounter reads load the
 * current Character (ADR 0034 decision 4). Creature and custom actors own that state in the Run.
 */
export const encounterRunActorStateSchema = z.discriminatedUnion('kind', [
  z.extend(encounterRunActorStateBaseSchema, {
    kind: z.literal('CHARACTER'),
    sourceId: postgresUuidSchema
  }),
  z.extend(encounterRunActorStateBaseSchema, {
    kind: z.enum(['CREATURE', 'CUSTOM']),
    sourceId: z.nullable(postgresUuidSchema),
    sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
    currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    conditions: jsonValueSchema
  })
])

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
export type EncounterRunCharacterActorState = Extract<EncounterRunActorState, { kind: 'CHARACTER' }>
export type EncounterRunState = z.infer<typeof encounterRunStateSchema>
