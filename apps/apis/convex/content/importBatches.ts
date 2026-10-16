// One import mutation must finish well inside Convex's 1 s user-time limit even
// on a CPU-contended host. Idle measurements on the local backend (PLATFORM-5.T1,
// docs/validation/platform-5-t1-seed-mutation-margin-2026-10-15.md) fit mutation
// time as about 25 ms per record plus 1 ms per KiB of document; a loaded host ran
// 3-6x slower. Costs are in idle milliseconds and the budget leaves that headroom.
// Every record costs more than 25, so a batch holds at most 3 records.
const RECORD_COST = 25
export const SOURCE_IMPORT_BATCH_COST_BUDGET = 100

const encoder = new TextEncoder()

export function sourceImportRecordCost(record: unknown) {
  // A Class carries the largest documents (up to about 155 KiB) and a Subclass re-reads and
  // parses its parent Class document, so batching cannot bound it: it always gets a batch
  // alone, and its time is the floor the budget cannot lower (717 ms at full host saturation).
  if (
    typeof record === 'object' &&
    record !== null &&
    'subjectKind' in record &&
    record.subjectKind === 'CLASS'
  )
    return SOURCE_IMPORT_BATCH_COST_BUDGET
  return RECORD_COST + encoder.encode(JSON.stringify(record)).byteLength / 1024
}

// Packs records in order up to the budget; a record at or over the budget gets its
// own batch. Never split a document. A record that replaces a stored subject (`alone`) also gets a
// batch alone: replacing costs about 100-250 ms idle however small the document is
// (PLATFORM-18.T1, docs/validation/platform-18-t1-replace-mutation-margin-2026-10-15.md), which the
// per-KiB fit above does not capture.
export function* sourceImportBatches<T>(records: readonly T[], alone?: (record: T) => boolean) {
  let batch: T[] = []
  let cost = 0
  for (const record of records) {
    const recordCost = alone?.(record)
      ? SOURCE_IMPORT_BATCH_COST_BUDGET
      : sourceImportRecordCost(record)
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
