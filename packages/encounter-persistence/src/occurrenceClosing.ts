import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { changedFields } from './documents.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument } from './store.js'
import type { EncounterPersistenceTransaction } from './ports.js'

/** Closes a pending occurrence that staged nothing on the Run: its snapshot goes and its version advances. */
export async function closePendingOccurrence(
  ctx: EncounterPersistenceTransaction,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  state: 'COMPLETED' | 'VOIDED'
) {
  const updatedAt = new Date().toISOString()
  const { _id, _creationTime, ...stored } = occurrence
  const closed = encounterStoredRuleOccurrenceSchema.parse({
    ...stored,
    state,
    version: occurrence.version + 1,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, null),
    completedAt: updatedAt,
    updatedAt
  })
  await ctx.db.patch(_id, changedFields(occurrence, closed))
  return closed
}
