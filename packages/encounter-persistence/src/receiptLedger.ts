import {
  liveSessionCheckpointHistoryEntrySchema,
  liveSessionCheckpointHistoryKeyFields,
  type LiveSessionCheckpointHistoryEntry,
  type LiveSessionCheckpointHistoryTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { encounterStoreSchemas } from '@artificer-toolkit/schema/projections/encounterStore'
import {
  receiptHeaderSchemas,
  type ReceiptHeaderDocuments,
  type ReceiptHeaderTable
} from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import {
  RECEIPT_LEDGER_MAX_BYTES,
  RECEIPT_LEDGER_MAX_ENTRIES,
  receiptLedgerMetadataSchema,
  receiptLedgerPayloadMetadataSchema,
  receiptLedgerPointerSchema,
  type ReceiptLedgerEncodedPayload,
  type ReceiptLedgerMetadata,
  type ReceiptLedgerPointer
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import {
  canonicalJsonRecordSchema,
  canonicalJsonValueSchema
} from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  decodeUtf8PayloadChunks,
  encodeUtf8PayloadChunks
} from '@artificer-toolkit/shared/jsonPayloadChunks'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'

function validateEntry(raw: unknown): LiveSessionCheckpointHistoryEntry {
  // Validate raw JSON first: the object-schema parser must never invoke a caller's getter.
  const json = canonicalizeJson(canonicalJsonRecordSchema.parse(raw))
  const entry = liveSessionCheckpointHistoryEntrySchema.parse(JSON.parse(json))
  if (checksumCanonicalJson(entry.value) !== entry.checksum)
    throw new Error('Receipt ledger entry checksum does not match.')
  const fields = liveSessionCheckpointHistoryKeyFields[entry.table]
  if (fields.some((field, index) => entry.value[field] !== entry.key[index]))
    throw new Error('Receipt ledger entry identity does not match its value.')
  const stored = Object.fromEntries(
    Object.entries(entry.value).map(([field, value]) => [
      field,
      field.endsWith('Json') && value !== null ? canonicalizeJson(value) : value
    ])
  )
  encounterStoreSchemas[entry.table].parse(stored)
  return entry
}

function validateEntries(raw: unknown): (LiveSessionCheckpointHistoryEntry | null)[] {
  if (
    !Array.isArray(raw) ||
    Object.getPrototypeOf(raw) !== Array.prototype ||
    raw.length === 0 ||
    raw.length > RECEIPT_LEDGER_MAX_ENTRIES
  )
    throw new Error('Receipt ledger entries are empty or invalid.')
  canonicalJsonValueSchema.parse(raw)
  const identities = new Set<string>()
  const entries: (LiveSessionCheckpointHistoryEntry | null)[] = []
  for (let index = 0; index < raw.length; index++) {
    const slot = raw[index]
    if (slot === null) {
      entries.push(null)
      continue
    }
    const entry = validateEntry(slot)
    const identity = `${entry.table}:${canonicalizeJson(entry.key)}`
    if (identities.has(identity)) throw new Error('Receipt ledger entry identity is duplicated.')
    identities.add(identity)
    entries.push(entry)
  }
  if (identities.size === 0) throw new Error('Receipt ledger has no live entries.')
  return entries
}

/** Slot order is preserved, including tombstones left by deleted receipts. */
export function encodeReceiptLedgerPayload(
  entries: readonly (LiveSessionCheckpointHistoryEntry | null)[]
): ReceiptLedgerEncodedPayload {
  const body = canonicalizeJson(validateEntries(entries))
  if (new TextEncoder().encode(body).byteLength > RECEIPT_LEDGER_MAX_BYTES)
    throw new Error('Receipt ledger exceeds its byte limit.')
  const chunks = encodeUtf8PayloadChunks(body)
  return {
    entryCount: entries.length,
    byteLength: chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
    checksum: sha256Hex(body),
    partCount: chunks.length === 1 ? 0 : chunks.length,
    payload: chunks.length === 1 ? chunks[0]! : null,
    parts: chunks.length === 1 ? [] : chunks
  }
}

/** Projects indexed metadata from a validated body, preserving the logical schema's scalars. */
export function projectReceiptHeader(
  raw: LiveSessionCheckpointHistoryEntry,
  pointer: ReceiptLedgerPointer
): ReceiptHeaderDocuments[ReceiptHeaderTable] {
  const entry = validateEntry(raw)
  const reference = receiptLedgerPointerSchema.parse(
    JSON.parse(canonicalizeJson(canonicalJsonRecordSchema.parse(pointer)))
  )
  if (reference.entryChecksum !== entry.checksum)
    throw new Error('Receipt header pointer checksum does not match its entry.')
  const fields =
    entry.table === 'encounterRunCommands'
      ? receiptHeaderSchemas.encounterRunCommands.def.options.flatMap((variant) =>
          Object.keys(variant.shape)
        )
      : Object.keys(receiptHeaderSchemas[entry.table].shape)
  const metadata = Object.fromEntries(
    [...new Set(fields)]
      .filter((field) => Object.hasOwn(entry.value, field))
      .map((field) => [field, entry.value[field]])
  )
  return receiptHeaderSchemas[entry.table].parse({ ...metadata, ...reference })
}

export function decodeReceiptLedgerPayload(
  encoded: ReceiptLedgerEncodedPayload
): (LiveSessionCheckpointHistoryEntry | null)[] {
  if (
    encoded === null ||
    typeof encoded !== 'object' ||
    Object.getPrototypeOf(encoded) !== Object.prototype ||
    Object.values(Object.getOwnPropertyDescriptors(encoded)).some(
      (descriptor) => !('value' in descriptor)
    ) ||
    !Object.hasOwn(encoded, 'payload') ||
    !Object.hasOwn(encoded, 'parts')
  )
    throw new Error('Receipt ledger payload is invalid.')
  const { payload, parts, ...rawMetadata } = encoded
  const metadata = receiptLedgerPayloadMetadataSchema.parse(rawMetadata)
  if (
    !Array.isArray(parts) ||
    Object.getPrototypeOf(parts) !== Array.prototype ||
    Object.values(Object.getOwnPropertyDescriptors(parts)).some(
      (descriptor) => !('value' in descriptor)
    ) ||
    (metadata.partCount === 0
      ? !(payload instanceof ArrayBuffer) || parts.length !== 0
      : payload !== null || metadata.partCount < 2 || parts.length !== metadata.partCount)
  )
    throw new Error('Receipt ledger inline payload or parts are invalid.')
  for (let index = 0; index < parts.length; index++)
    if (!Object.hasOwn(parts, index)) throw new Error('Receipt ledger parts are sparse.')
  const body = decodeUtf8PayloadChunks(
    metadata.partCount === 0 ? [payload!] : parts,
    metadata.byteLength
  )
  if (sha256Hex(body) !== metadata.checksum)
    throw new Error('Receipt ledger payload checksum does not match.')
  const raw: unknown = JSON.parse(body)
  if (canonicalizeJson(raw) !== body) throw new Error('Receipt ledger payload is not canonical.')
  const entries = validateEntries(raw)
  if (entries.length !== metadata.entryCount)
    throw new Error('Receipt ledger entry count does not match.')
  return entries
}

/**
 * `entries` must be decoded from this head's payload metadata by decodeReceiptLedgerPayload.
 * Private Character receipts and shared Encounter receipts use separate ownership scopes.
 */
export function readReceiptLedgerEntry(
  head: ReceiptLedgerMetadata,
  entries: readonly (LiveSessionCheckpointHistoryEntry | null)[],
  pointer: ReceiptLedgerPointer,
  expected: { table: LiveSessionCheckpointHistoryTable; key: (string | number)[] }
): LiveSessionCheckpointHistoryEntry {
  const metadata = receiptLedgerMetadataSchema.parse(
    JSON.parse(canonicalizeJson(canonicalJsonRecordSchema.parse(head)))
  )
  const reference = receiptLedgerPointerSchema.parse(
    JSON.parse(canonicalizeJson(canonicalJsonRecordSchema.parse(pointer)))
  )
  const identity = canonicalJsonRecordSchema.parse(
    JSON.parse(canonicalizeJson(canonicalJsonRecordSchema.parse(expected)))
  )
  if (
    reference.ledgerId !== metadata.id ||
    !Array.isArray(entries) ||
    entries.length !== metadata.entryCount ||
    reference.entryIndex >= entries.length
  )
    throw new Error('Receipt ledger pointer does not match its ledger.')
  const slot = Object.getOwnPropertyDescriptor(entries, reference.entryIndex)
  if (!slot || !('value' in slot) || slot.value === null)
    throw new Error('Receipt ledger pointer refers to a deleted or invalid slot.')
  const entry = validateEntry(slot.value)
  if (
    entry.checksum !== reference.entryChecksum ||
    entry.table !== identity.table ||
    canonicalizeJson(entry.key) !== canonicalizeJson(identity.key)
  )
    throw new Error('Receipt ledger pointer identity or checksum does not match.')
  if (
    metadata.scope === 'CHARACTER'
      ? entry.table !== 'characterCommandReceipts' || entry.value.characterId !== metadata.scopeId
      : entry.table === 'characterCommandReceipts' || entry.value.campaignId !== metadata.scopeId
  )
    throw new Error('Receipt ledger entry scope does not match.')
  return entry
}
