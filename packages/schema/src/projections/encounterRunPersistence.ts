import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { encounterCreatureEquipmentReplacementSchema } from './encounterCreatureEquipment.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'

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

/**
 * One app roll for a pending evidence request ("Roll dice"). Rows are immutable: a settle by
 * `rollId` reads these faces, and every attempt stays for the roll log and audit.
 */
export const encounterStoredEvidenceRollSchema = z.strictObject({
  id: postgresUuidSchema,
  campaignId: postgresUuidSchema,
  encounterId: postgresUuidSchema,
  occurrenceId: postgresUuidSchema,
  occurrenceVersion: z.number().check(z.int()).check(z.nonnegative()),
  requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
  userId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  commandFingerprint: projectionChecksumSchema,
  attempt: z.number().check(z.int()).check(z.positive()),
  faces: z.array(z.number().check(z.int())).check(z.minLength(1)).check(z.maxLength(2)),
  value: z.number().check(z.int()),
  rollMode: z.nullable(z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])),
  derivedRollMode: z.nullable(z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])),
  createdAt: z.iso.datetime()
})
export type EncounterStoredEvidenceRoll = z.infer<typeof encounterStoredEvidenceRollSchema>

/**
 * The voluntary movement an actor spent during one turn, in feet (D38). The turn is the Run's round
 * and current actor, so a new turn reads a new key and starts at zero. It sits outside the Run's
 * version and checksum: the budget is displayed, never enforced, so no fence reads it.
 */
export const encounterStoredTurnMovementSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  round: z.number().check(z.int()).check(z.positive()),
  turnActorId: postgresUuidSchema,
  actorId: postgresUuidSchema,
  usedFeet: z.number().check(z.nonnegative())
})
export type EncounterStoredTurnMovement = z.infer<typeof encounterStoredTurnMovementSchema>

/** A movement decision the GM skipped (D26, D39), so its player's drawer can say so. */
export const encounterStoredDecisionSkipSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  occurrenceId: postgresUuidSchema,
  occurrenceVersion: z.number().check(z.int()).check(z.nonnegative()),
  voidCommandId: postgresUuidSchema
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
      'SET_HEALTH_DISPLAY_DEFAULT',
      'COMPLETE',
      'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
    ])
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.enum(['START', 'ADVANCE_TURN', 'MOVE_SCENE_TOKEN', 'RESOLVE_RULE_OCCURRENCE']),
    ruleOccurrenceId: postgresUuidSchema,
    ruleResultChecksum: projectionChecksumSchema,
    optionalCombatSnapshotChecksum: projectionChecksumSchema
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('RESOLVE_ACTION'),
    ruleOccurrenceId: postgresUuidSchema,
    ruleResultChecksum: projectionChecksumSchema,
    optionalCombatSnapshotChecksum: projectionChecksumSchema,
    /** Warnings the submitter overrode ("Do it anyway"); the GM timeline badges each one. */
    ruleOverrides: encounterRuleWarningsDtoSchema
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('VOID_RULE_OCCURRENCE'),
    ruleOccurrenceId: postgresUuidSchema
  }),
  z.extend(encounterStoredRunCommandResultSchema, {
    commandType: z.literal('REVERT_LAST_ACTION'),
    /** The undone RESOLVE_ACTION root command and its occurrence. */
    revertedCommandId: postgresUuidSchema,
    ruleOccurrenceId: postgresUuidSchema
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
    state: z.enum(['PENDING', 'COMPLETED', 'VOIDED']),
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
        occurrence.state !== 'PENDING'
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
