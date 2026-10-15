import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { canonicalJsonRecordSchema, jsonDeltaSchema } from '../shared/jsonDelta.js'
import { liveSessionCheckpointSceneSchema } from './liveSessionCheckpointScenes.js'
import { gmCampaignRollDtoSchema, rollRecordDtoSchema } from './rolls.js'
import {
  encounterStoreSchemas,
  type EncounterStoreDocuments
} from '../projections/encounterStore.js'

/** Public identities of room-owned records; database and SQLite row ids never cross this seam. */
export const liveSessionCheckpointKeyFields = {
  encounterRuns: ['id'],
  encounterRunActors: ['encounterId', 'id'],
  encounterActorSnapshots: ['encounterId', 'checksum'],
  encounterSourceProjectionFacts: ['encounterId', 'checksum'],
  encounterSceneBindings: ['encounterId'],
  encounterActorTokenBindings: ['encounterId', 'actorId'],
  encounterInitiativeRounds: ['encounterId', 'round'],
  encounterInitiativeParticipants: ['encounterId', 'round', 'actorId'],
  encounterInitiativeSides: ['encounterId', 'round', 'sideId'],
  encounterRuleOccurrences: ['id'],
  encounterReplayIndex: ['campaignId', 'commandId'],
  encounterPendingSnapshotParts: ['occurrenceId', 'sequence'],
  encounterTurnMovements: ['encounterId', 'round', 'turnActorId', 'actorId'],
  encounterDecisionSkips: ['encounterId', 'occurrenceId', 'occurrenceVersion'],
  characterActiveRuleEffects: ['id'],
  encounterActiveRuleEffects: ['id'],
  encounterMaintainedEffectStates: ['id'],
  encounterSpatialRuleEffects: ['id'],
  characterPlayStates: ['characterId'],
  campaignConversations: ['id'],
  campaignConversationMembers: ['conversationId', 'userId'],
  campaignConversationEntries: ['id'],
  campaignConversationEntryPayloads: ['entryId']
} as const satisfies Partial<{
  [Table in keyof EncounterStoreDocuments]: readonly (keyof EncounterStoreDocuments[Table] &
    string)[]
}>

/**
 * Append-only evidence is packed separately from mutable record deltas. Encounter history stays in
 * the room (ADR 0035 Amendment 22); only Sheet command receipts reach Convex.
 */
export const liveSessionCheckpointHistoryKeyFields = {
  characterCommandReceipts: ['characterId', 'commandId']
} as const satisfies Partial<{
  [Table in keyof EncounterStoreDocuments]: readonly (keyof EncounterStoreDocuments[Table] &
    string)[]
}>

/** Receipt ledgers pack Sheet command receipts and the Encounter history Convex-side writers record. */
export const receiptLedgerEntryKeyFields = {
  encounterRunCommands: ['campaignId', 'commandId'],
  encounterRuleReceipts: ['campaignId', 'commandId'],
  ...liveSessionCheckpointHistoryKeyFields
} as const

export const liveSessionCheckpointTableSchema = lazySchema(() =>
  z.enum(
    Object.keys(liveSessionCheckpointKeyFields) as [
      keyof typeof liveSessionCheckpointKeyFields,
      ...(keyof typeof liveSessionCheckpointKeyFields)[]
    ]
  )
)

const keySchema = lazySchema(() =>
  z
    .array(
      z.union([
        postgresUuidSchema,
        projectionChecksumSchema,
        z.number().check(z.int()).check(z.nonnegative())
      ])
    )
    .check(z.minLength(1))
    .check(z.maxLength(4))
)

function validKey(fields: readonly string[], key: (string | number)[]) {
  return (
    fields.length === key.length &&
    fields.every((field, index) => {
      const value = key[index]
      if (field === 'round' || field === 'sequence' || field === 'occurrenceVersion')
        return typeof value === 'number' && (field !== 'occurrenceVersion' || value >= 0)
      return (field === 'checksum' ? projectionChecksumSchema : postgresUuidSchema).safeParse(value)
        .success
    })
  )
}

export const liveSessionCheckpointRecordChangeSchema = lazySchema(() =>
  z
    .strictObject({
      table: liveSessionCheckpointTableSchema,
      key: keySchema,
      previousChecksum: z.nullable(projectionChecksumSchema),
      nextChecksum: z.nullable(projectionChecksumSchema),
      delta: z.nullable(jsonDeltaSchema)
    })
    .check(
      z.superRefine((change, context) => {
        if (!validKey(liveSessionCheckpointKeyFields[change.table], change.key))
          context.addIssue({ code: 'custom', message: 'Checkpoint record identity is incomplete.' })
        if (
          change.previousChecksum === change.nextChecksum ||
          (change.nextChecksum === null) !== (change.delta === null) ||
          (change.previousChecksum === null && change.delta !== null && !('set' in change.delta))
        )
          context.addIssue({ code: 'custom', message: 'Checkpoint record delta is invalid.' })
      })
    )
)

function ledgerEntrySchema<Table extends string>(fields: Record<Table, readonly string[]>) {
  return z
    .strictObject({
      table: z.enum(Object.keys(fields) as [Table, ...Table[]]),
      key: keySchema,
      value: canonicalJsonRecordSchema,
      checksum: projectionChecksumSchema
    })
    .check(
      z.superRefine((entry, context) => {
        if (!validKey(fields[entry.table], entry.key))
          context.addIssue({
            code: 'custom',
            message: 'Checkpoint evidence identity is incomplete.'
          })
      })
    )
}

export const liveSessionCheckpointHistoryEntrySchema = lazySchema(() =>
  ledgerEntrySchema(liveSessionCheckpointHistoryKeyFields)
)
export const receiptLedgerEntrySchema = lazySchema(() =>
  ledgerEntrySchema(receiptLedgerEntryKeyFields)
)

/** Serialized committed writes are validated before the checkpoint builder replays them. */
export const liveSessionRoomWriteSetSchema = lazySchema(() => {
  const id = z.string().check(z.minLength(1))
  const record = z.strictObject({
    kind: id,
    key: id,
    revision: z.nullable(z.string()),
    json: z.string()
  })
  return z.array(
    z.discriminatedUnion('op', [
      z.strictObject({
        // RESTORE is an authorized Convex input read, already part of the durable product base.
        op: z.enum(['INSERT', 'RESTORE']),
        table: z.enum(
          Object.keys(encounterStoreSchemas) as [
            keyof EncounterStoreDocuments,
            ...(keyof EncounterStoreDocuments)[]
          ]
        ),
        id,
        creationTime: z.number().check(z.nonnegative()),
        fields: canonicalJsonRecordSchema
      }),
      z.strictObject({
        op: z.literal('PATCH'),
        id,
        fields: canonicalJsonRecordSchema,
        remove: z.array(id)
      }),
      z.strictObject({ op: z.literal('REPLACE'), id, fields: canonicalJsonRecordSchema }),
      z.strictObject({ op: z.literal('DELETE'), id }),
      z.strictObject({ op: z.literal('RECORD_SET'), record }),
      z.strictObject({ op: z.literal('RECORD_DELETE'), kind: id, key: id })
    ])
  )
})

export type LiveSessionCheckpointTable = z.infer<typeof liveSessionCheckpointTableSchema>
export type LiveSessionCheckpointHistoryTable = keyof typeof liveSessionCheckpointHistoryKeyFields
export type LiveSessionCheckpointRecordChange = z.infer<
  typeof liveSessionCheckpointRecordChangeSchema
>
export type ReceiptLedgerEntry = z.infer<typeof receiptLedgerEntrySchema>
export type ReceiptLedgerEntryTable = keyof typeof receiptLedgerEntryKeyFields

/**
 * Private room rolls merge into the user's bounded history, never replace its global snapshot. The
 * Campaign GM's roll carries its reveal binding; a player's own copy of a hidden creature they
 * control carries none.
 */
export const liveSessionCheckpointRetainedRollSchema = lazySchema(() =>
  z.strictObject({
    userId: postgresUuidSchema,
    record: rollRecordDtoSchema,
    gmCampaignRoll: z.nullable(gmCampaignRollDtoSchema)
  })
)
export type LiveSessionCheckpointRetainedRoll = z.infer<
  typeof liveSessionCheckpointRetainedRollSchema
>

export const liveSessionCheckpointRecordsSchema = lazySchema(() =>
  z.strictObject({
    changes: z.array(liveSessionCheckpointRecordChangeSchema),
    history: z.array(liveSessionCheckpointHistoryEntrySchema),
    scenes: z.array(liveSessionCheckpointSceneSchema),
    retainedRolls: z.optional(z.array(liveSessionCheckpointRetainedRollSchema))
  })
)
export type LiveSessionCheckpointRecords = z.infer<typeof liveSessionCheckpointRecordsSchema>
