// One import mutation must finish well inside Convex's 1 s user-time limit even
// on a CPU-contended host. Idle measurements on the local backend (PLATFORM-5.T1,
// docs/validation/platform-5-t1-seed-mutation-margin-2026-10-15.md) fit mutation
// time as a fixed cost per record plus a cost per KiB of document; loaded hosts ran
// 3-6x slower. Costs are in idle milliseconds and the budget leaves that headroom.
const RECORD_COST = 25
const KIB_COST = 1
export const SOURCE_IMPORT_BATCH_COST_BUDGET = 100

const encoder = new TextEncoder()

export function sourceImportRecordCost(record: unknown) {
  // A Class carries the largest documents and a Subclass re-reads and parses its
  // parent Class document, which dwarfs its own size; it always gets a batch alone.
  if (
    typeof record === 'object' &&
    record !== null &&
    'subjectKind' in record &&
    record.subjectKind === 'CLASS'
  )
    return SOURCE_IMPORT_BATCH_COST_BUDGET
  return RECORD_COST + (encoder.encode(JSON.stringify(record)).byteLength / 1024) * KIB_COST
}

// Packs records in order up to the budget; a record at or over the budget gets its
// own batch. Never split a document.
export function* sourceImportBatches<T>(records: readonly T[]) {
  let batch: T[] = []
  let cost = 0
  for (const record of records) {
    const recordCost = sourceImportRecordCost(record)
    if (batch.length && cost + recordCost > SOURCE_IMPORT_BATCH_COST_BUDGET) {
      yield batch
      batch = []
      cost = 0
    }
    batch.push(record)
    cost += recordCost
  }
  if (batch.length) yield batch
}
