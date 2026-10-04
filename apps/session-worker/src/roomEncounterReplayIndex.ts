import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { EncounterStoreDocuments } from '@artificer-toolkit/schema/projections/encounterStore'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { RoomEncounterStore } from './roomEncounterStore.js'

type ReplayIndexRow = EncounterStoreDocuments['encounterReplayIndex']

/**
 * What the room's replay index says about a command ID whose history rows are gone: `NONE` when
 * the history still holds it (the Encounter planner replays it with its original result) or no
 * index row exists, `INDEXED` for the same actor and input, `MISMATCH` for a reused ID.
 */
export async function lookupRoomEncounterReplay(
  store: RoomEncounterStore,
  input: { campaignId: string; commandId: string; encounterId: string; userId: string; fingerprint: string }
): Promise<
  | { kind: 'NONE' | 'MISMATCH' }
  | { kind: 'INDEXED'; encounterId: string; version: number; roll: RollRecordDto | null }
> {
  const { campaignId } = input
  const commandId = input.commandId.toLowerCase()
  const recorded = await Promise.all([
    store.store
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaignId).eq('commandId', commandId)
      )
      .first(),
    store.store
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaignId).eq('commandId', commandId)
      )
      .first(),
    store.store
      .query('encounterEvidenceRolls')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', campaignId).eq('commandId', commandId)
      )
      .first()
  ])
  if (recorded.some((row) => row !== null)) return { kind: 'NONE' }
  const row = await store.store
    .query('encounterReplayIndex')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaignId).eq('commandId', commandId)
    )
    .unique()
  if (!row) return { kind: 'NONE' }
  if (
    row.encounterId !== input.encounterId.toLowerCase() ||
    row.actorUserId !== input.userId.toLowerCase() ||
    row.commandFingerprint !== input.fingerprint
  )
    return { kind: 'MISMATCH' }
  // The roll is the persisted roll card's, never a second roll.
  const rollCardId = row.rollCardId
  const card = rollCardId
    ? await store.store
        .query('campaignConversationEntryPayloads')
        .withIndex('by_entryId', (q) => q.eq('entryId', rollCardId))
        .unique()
    : null
  return {
    kind: 'INDEXED',
    encounterId: row.encounterId,
    version: row.version,
    roll: card?.roll ?? null
  }
}

/** One index row per committed room command; a command the history already replayed adds none. */
export async function recordRoomEncounterReplay(
  db: EncounterWriteTransaction['db'],
  row: ReplayIndexRow
) {
  const prior = await db
    .query('encounterReplayIndex')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', row.campaignId).eq('commandId', row.commandId)
    )
    .unique()
  if (!prior) await db.insert('encounterReplayIndex', row)
}

/** A completed Run keeps no timeline: its history rows and replay index leave the room's store. */
export async function removeRoomEncounterTimeline(
  db: EncounterWriteTransaction['db'],
  encounterId: string
) {
  const [commands, receipts, evidence, index] = await Promise.all([
    db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    db
      .query('encounterEvidenceRolls')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    db
      .query('encounterReplayIndex')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .collect()
  ])
  for (const row of commands) await db.delete(row._id)
  for (const row of receipts) await db.delete(row._id)
  for (const row of evidence) await db.delete(row._id)
  for (const row of index) await db.delete(row._id)
}
