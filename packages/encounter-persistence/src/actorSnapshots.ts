import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumActorSnapshot } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { deriveOnce } from './transactionReads.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

function readSnapshotRow(ctx: EncounterReadContext, encounterId: string, checksum: string) {
  return ctx.db
    .query('encounterActorSnapshots')
    .withIndex('by_encounterId_checksum', (q) =>
      q.eq('encounterId', encounterId).eq('checksum', checksum)
    )
    .unique()
}

function parseSnapshotRow(row: EncounterDocument<'encounterActorSnapshots'>) {
  const snapshot = jsonValueSchema.parse(JSON.parse(row.snapshotJson))
  if (checksumActorSnapshot(snapshot) !== row.checksum)
    throw new Error('Encounter actor snapshot checksum mismatch.')
  return snapshot
}

/** A snapshot row's verified snapshot; shared and frozen where reads are memoized. */
export function readStoredActorSnapshot(row: EncounterDocument<'encounterActorSnapshots'>) {
  return deriveOnce(row, parseSnapshotRow)
}

/** The verified snapshot the Run stores under `checksum`. */
export async function readActorSnapshot(
  ctx: EncounterReadContext,
  encounterId: string,
  checksum: string
) {
  const row = await readSnapshotRow(ctx, encounterId, checksum)
  if (!row) throw new Error('Encounter actor snapshot is unavailable.')
  return readStoredActorSnapshot(row)
}

/** Stores a snapshot once: rows are immutable, and a changed snapshot is a new row. */
export async function ensureActorSnapshot(
  ctx: EncounterWriteContext,
  encounterId: string,
  checksum: string,
  snapshot: EncounterRunActorState['snapshot']
) {
  if (await readSnapshotRow(ctx, encounterId, checksum)) return
  await ctx.db.insert('encounterActorSnapshots', {
    encounterId,
    checksum,
    snapshotJson: JSON.stringify(snapshot)
  })
}

/** Deletes a snapshot once no actor of the Run names it. */
export async function releaseActorSnapshot(
  ctx: EncounterWriteContext,
  encounterId: string,
  checksum: string
) {
  const named = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_snapshotChecksum', (q) =>
      q.eq('encounterId', encounterId).eq('snapshotChecksum', checksum)
    )
    .first()
  if (named) return
  const row = await readSnapshotRow(ctx, encounterId, checksum)
  if (row) await ctx.db.delete(row._id)
}
