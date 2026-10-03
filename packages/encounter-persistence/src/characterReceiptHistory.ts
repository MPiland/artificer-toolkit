import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import type { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

/** Kept apart from the replay module so storage readers do not load the full Sheet command schemas. */
export function readCharacterReceiptHistory(
  receipt: ReturnType<typeof characterStoredCommandReceiptSchema.parse>
) {
  const raw: unknown = JSON.parse(receipt.historyJson)
  if (checksumRuleDocument(raw) !== receipt.historyChecksum)
    throw new Error('Stored Sheet command receipt history checksum mismatch.')
  const historyEntry = characterHistoryEntryDtoSchema.parse(raw)
  if (
    historyEntry.eventId !== receipt.id ||
    historyEntry.actorId !== receipt.actorId ||
    historyEntry.occurredAt !== receipt.occurredAt
  ) {
    throw new Error('Stored Sheet command receipt history identity mismatch.')
  }
  return historyEntry
}
