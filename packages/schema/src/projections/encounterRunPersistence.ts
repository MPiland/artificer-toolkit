import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { encounterCreatureEquipmentReplacementSchema } from './encounterCreatureEquipment.js'

// Keep the Convex table schema independent of recursive authored snapshots.
export const encounterStoredRunSchema = z.strictObject({
  id: postgresUuidSchema,
  campaignId: postgresUuidSchema,
  gameSystemId: postgresUuidSchema,
  status: z.enum(['PREPARED', 'ACTIVE', 'COMPLETED']),
  version: z.number().check(z.int()).check(z.nonnegative()),
  stateJson: z.string(),
  stateChecksum: projectionChecksumSchema,
  projectionJson: z.string(),
  projectionChecksum: projectionChecksumSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
})

export const encounterStoredRunActorSchema = z.strictObject({
  id: postgresUuidSchema,
  encounterId: postgresUuidSchema,
  stateJson: z.string(),
  stateChecksum: projectionChecksumSchema
})

export const encounterSceneBindingSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  campaignId: postgresUuidSchema,
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  commandFingerprint: projectionChecksumSchema,
  createdAt: z.iso.datetime()
})
export const encounterActorTokenBindingSchema = z.strictObject({
  actorId: postgresUuidSchema,
  encounterId: postgresUuidSchema,
  sceneId: postgresUuidSchema,
  tokenId: postgresUuidSchema
})

const encounterStoredRunCommandBaseSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  encounterId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  commandFingerprint: projectionChecksumSchema,
  actorUserId: postgresUuidSchema,
  createdAt: z.iso.datetime(),
  // Optional until the Encounter timeline metadata backfill has completed.
  visibility: z.optional(z.enum(['PRIVATE', 'TABLE']))
})

const encounterStoredRunCommandResultSchema = z.extend(encounterStoredRunCommandBaseSchema, {
  id: postgresUuidSchema,
  version: z.number().check(z.int()).check(z.positive()),
  commandJson: z.string(),
  resultJson: z.string(),
  resultChecksum: projectionChecksumSchema
})

export const encounterStoredRunCommandSchema = z.discriminatedUnion('commandType', [
  z.extend(encounterStoredRunCommandBaseSchema, {
    commandType: z.literal('CREATE'),
    id: z.optional(postgresUuidSchema),
    version: z.optional(z.literal(0))
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.enum([
      'UPSERT_REMINDER',
      'REMOVE_REMINDER',
      'SET_INITIATIVE',
      'ROLL_ACTOR_INITIATIVE',
      'ROLL_ENEMY_ACTION',
      'ADJUST_FEATURE_RESOURCE',
      'REPLACE_OPTIONAL_COMBAT_RULES',
      'COMPLETE',
      'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
    ])
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.enum([
      'START',
      'ADVANCE_TURN',
      'MOVE_SCENE_TOKEN',
      'RESOLVE_ACTION',
      'RESOLVE_RULE_OCCURRENCE'
    ]),
    ruleOccurrenceId: postgresUuidSchema,
    ruleResultChecksum: projectionChecksumSchema,
    optionalCombatSnapshotChecksum: projectionChecksumSchema
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('UPDATE_ACTOR'),
    characterReceiptId: z.nullable(postgresUuidSchema)
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('REMOVE_ACTOR'),
    ruleOccurrenceId: z.nullable(postgresUuidSchema),
    ruleResultChecksum: z.nullable(projectionChecksumSchema),
    initiativeStateJson: z.nullable(z.string()),
    initiativeStateChecksum: z.nullable(projectionChecksumSchema)
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('REORDER'),
    initiativeStateJson: z.nullable(z.string()),
    initiativeStateChecksum: z.nullable(projectionChecksumSchema)
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('REINFORCE'),
    reinforcedActorId: postgresUuidSchema,
    reinforcedActorStateJson: z.string(),
    reinforcedActorStateChecksum: projectionChecksumSchema,
    initiativeStateJson: z.nullable(z.string()),
    initiativeStateChecksum: z.nullable(projectionChecksumSchema)
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('REPLACE_CREATURE_EQUIPMENT'),
    creatureEquipmentReplacement: encounterCreatureEquipmentReplacementSchema
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.enum(['PREVIOUS_TURN', 'SET_CURRENT_ACTOR', 'SET_ROUND']),
    initiativeStateJson: z.string(),
    initiativeStateChecksum: projectionChecksumSchema
  })
])

export const encounterStoredRuleOccurrenceSchema = z
  .strictObject({
    id: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    rootCommandId: postgresUuidSchema,
    state: z.enum(['PENDING', 'COMPLETED']),
    version: z.number().check(z.int()).check(z.nonnegative()),
    expectedEncounterVersion: z.number().check(z.int()).check(z.nonnegative()),
    pendingSnapshotJson: z.nullable(z.string()),
    pendingSnapshotChecksum: z.nullable(projectionChecksumSchema),
    completedAt: z.nullable(z.iso.datetime()),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .check(
    z.superRefine((occurrence, context) => {
      if (
        occurrence.state === 'COMPLETED'
          ? occurrence.pendingSnapshotJson !== null ||
            occurrence.pendingSnapshotChecksum !== null ||
            occurrence.completedAt === null
          : occurrence.pendingSnapshotJson === null ||
            occurrence.pendingSnapshotChecksum === null ||
            occurrence.completedAt !== null
      )
        context.addIssue({ code: 'custom', message: 'Rule occurrence state is inconsistent.' })
    })
  )

export const encounterStoredRuleReceiptSchema = z.strictObject({
  id: postgresUuidSchema,
  campaignId: postgresUuidSchema,
  encounterId: postgresUuidSchema,
  occurrenceId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  commandType: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  commandFingerprint: projectionChecksumSchema,
  encounterVersion: z.number().check(z.int()).check(z.nonnegative()),
  commandMetadataJson: z.string(),
  resultJson: z.string(),
  resultChecksum: projectionChecksumSchema,
  actorUserId: postgresUuidSchema,
  correlationId: z.nullable(postgresUuidSchema),
  createdAt: z.iso.datetime()
})
