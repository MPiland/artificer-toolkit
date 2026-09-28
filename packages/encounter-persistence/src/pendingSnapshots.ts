import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { deriveOnce } from './transactionReads.js'
import type { EncounterDocument } from './store.js'

type StoredOccurrence = Pick<EncounterDocument<'encounterRuleOccurrences'>, 'pendingSnapshotJson'>

/**
 * An occurrence's stored pending snapshot, or null when it has none. In a memoized transaction it
 * is parsed (with its schema refinements, which hash parts of it) once per stored content, however
 * often and wherever the occurrence is read; callers still compare its stored checksum.
 */
export function readStoredPendingSnapshot(occurrence: StoredOccurrence) {
  return deriveOnce(occurrence, parseStoredPendingSnapshot, storedSnapshotIdentity)
}

/** The checksum of `readStoredPendingSnapshot`'s snapshot, computed once per stored content. */
export function storedPendingSnapshotChecksum(occurrence: StoredOccurrence) {
  return deriveOnce(occurrence, checksumStoredPendingSnapshot, storedSnapshotIdentity)
}

function parseStoredPendingSnapshot(occurrence: StoredOccurrence) {
  return occurrence.pendingSnapshotJson === null
    ? null
    : serverRuleExecutionPendingSnapshotDtoSchema.parse(JSON.parse(occurrence.pendingSnapshotJson))
}

function checksumStoredPendingSnapshot(occurrence: StoredOccurrence) {
  const snapshot = readStoredPendingSnapshot(occurrence)
  return snapshot && checksumCanonicalJson(snapshot)
}

const storedSnapshotIdentity = (occurrence: StoredOccurrence) =>
  JSON.stringify(occurrence.pendingSnapshotJson)
