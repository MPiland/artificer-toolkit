import { describe, expect, it } from 'vitest'
import {
  receiptLedgerEntryKeyFields,
  receiptLedgerEntrySchema,
  type ReceiptLedgerEntry,
  type ReceiptLedgerEntryTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  RECEIPT_LEDGER_MAX_BYTES,
  RECEIPT_LEDGER_MAX_ENTRIES,
  RECEIPT_LEDGER_MAX_PARTS,
  receiptLedgerMetadataSchema,
  type ReceiptLedgerEncodedPayload,
  type ReceiptLedgerMetadata,
  type ReceiptLedgerPointer
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import {
  canonicalJsonRecordSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encodeUtf8PayloadChunks,
  JSON_PAYLOAD_CHUNK_MAX_BYTES
} from '@artificer-toolkit/shared/jsonPayloadChunks'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import {
  decodeReceiptLedgerPayload,
  encodeReceiptLedgerPayload,
  projectReceiptHeader,
  readReceiptLedgerEntry
} from '../receiptLedger.js'

const uuid = (ordinal: number) =>
  `00000000-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`
const timestamp = '2026-09-29T00:00:00.000Z'
const campaignId = uuid(1)
const characterId = uuid(2)
const checksum = sha256Hex('fixture')

function historyEntry(
  table: ReceiptLedgerEntryTable,
  value: Record<string, JsonValue>
): ReceiptLedgerEntry {
  return receiptLedgerEntrySchema.parse({
    table,
    key: receiptLedgerEntryKeyFields[table].map((field) => value[field]),
    value,
    checksum: checksumCanonicalJson(value)
  })
}

function characterReceipt(ordinal = 1, history: JsonValue = { ordinal }): ReceiptLedgerEntry {
  return historyEntry('characterCommandReceipts', {
    id: uuid(100 + ordinal),
    characterId,
    commandId: uuid(200 + ordinal),
    actorId: uuid(3),
    commandFingerprint: checksum,
    occurredAt: timestamp,
    historyJson: history,
    historyChecksum: checksumCanonicalJson(history)
  })
}

function encounterEntries(): ReceiptLedgerEntry[] {
  const command = { type: 'UPSERT_REMINDER', label: 'Ready' }
  const replay = { roll: null, occurrence: null }
  const result = { settled: true }
  return [
    historyEntry('encounterRunCommands', {
      id: uuid(10),
      campaignId,
      encounterId: uuid(4),
      commandId: uuid(11),
      commandFingerprint: checksum,
      actorUserId: uuid(3),
      createdAt: timestamp,
      visibility: 'TABLE',
      commandType: 'UPSERT_REMINDER',
      version: 1,
      commandJson: command,
      replayReceiptJson: replay,
      replayReceiptChecksum: checksumCanonicalJson(replay)
    }),
    historyEntry('encounterRuleReceipts', {
      id: uuid(12),
      campaignId,
      encounterId: uuid(4),
      occurrenceId: uuid(5),
      commandId: uuid(13),
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      commandFingerprint: checksum,
      encounterVersion: 1,
      commandMetadataJson: { label: 'Attack' },
      resultJson: result,
      resultChecksum: checksumCanonicalJson(result),
      actorUserId: uuid(3),
      correlationId: null,
      createdAt: timestamp
    })
  ]
}

function encodedBody(body: string, entryCount: number): ReceiptLedgerEncodedPayload {
  const chunks = encodeUtf8PayloadChunks(body)
  return {
    entryCount,
    byteLength: chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
    checksum: sha256Hex(body),
    partCount: chunks.length === 1 ? 0 : chunks.length,
    payload: chunks.length === 1 ? chunks[0]! : null,
    parts: chunks.length === 1 ? [] : chunks
  }
}

function head(encoded: ReceiptLedgerEncodedPayload): ReceiptLedgerMetadata {
  return {
    id: uuid(20),
    scope: 'CAMPAIGN',
    scopeId: campaignId,
    epoch: uuid(21),
    checkpointId: uuid(23),
    createdAt: timestamp,
    entryCount: encoded.entryCount,
    byteLength: encoded.byteLength,
    checksum: encoded.checksum,
    partCount: encoded.partCount
  }
}

function pointer(entry: ReceiptLedgerEntry, entryIndex = 0): ReceiptLedgerPointer {
  return { ledgerId: uuid(20), entryIndex, entryChecksum: entry.checksum }
}

describe('receipt ledger', () => {
  it('projects only indexed scalar headers and binds their pointers to the complete bodies', () => {
    for (const entry of [...encounterEntries(), characterReceipt()]) {
      const reference = pointer(entry)
      const header = projectReceiptHeader(entry, reference)
      expect(header).toMatchObject(reference)
      expect(header).toHaveProperty('commandFingerprint', entry.value.commandFingerprint)
      expect(Object.keys(header).some((field) => field.endsWith('Json'))).toBe(false)
      expect(header).not.toHaveProperty('faces')
      expect(() => projectReceiptHeader(entry, { ...reference, entryChecksum: checksum })).toThrow(
        /checksum/
      )
      expect(() =>
        projectReceiptHeader(
          { ...entry, value: { ...entry.value, commandFingerprint: sha256Hex('tampered') } },
          reference
        )
      ).toThrow(/checksum/)
    }
  })

  it('refuses oversized ledgers and advertised allocation or part counts before decoding', () => {
    const encoded = encodeReceiptLedgerPayload([characterReceipt()])
    expect(() =>
      encodeReceiptLedgerPayload(Array.from({ length: RECEIPT_LEDGER_MAX_ENTRIES + 1 }, () => null))
    ).toThrow(/invalid/)
    expect(() =>
      encodeReceiptLedgerPayload([
        characterReceipt(1, { text: 'x'.repeat(RECEIPT_LEDGER_MAX_BYTES) })
      ])
    ).toThrow(/byte limit/)
    for (const metadata of [
      { byteLength: RECEIPT_LEDGER_MAX_BYTES + 1 },
      { entryCount: RECEIPT_LEDGER_MAX_ENTRIES + 1 },
      { partCount: RECEIPT_LEDGER_MAX_PARTS + 1 }
    ])
      expect(() => decodeReceiptLedgerPayload({ ...encoded, ...metadata })).toThrow()
  })

  it('round-trips every stored history table inline in the supplied order without changing input', () => {
    const entries = [...encounterEntries().reverse(), characterReceipt()]
    const before = structuredClone(entries)
    const encoded = encodeReceiptLedgerPayload(entries)
    expect(encoded.partCount).toBe(0)
    expect(encoded.payload).toBeInstanceOf(ArrayBuffer)
    expect(encoded.parts).toEqual([])
    expect(decodeReceiptLedgerPayload(encoded)).toEqual(entries)
    expect(encoded.checksum).toBe(sha256Hex(canonicalizeJson(entries)))
    expect(entries).toEqual(before)
  })

  it('round-trips multibyte history larger than one chunk, including split UTF-8 characters', () => {
    const entries = [characterReceipt(1, { text: '🐉é'.repeat(JSON_PAYLOAD_CHUNK_MAX_BYTES) })]
    const encoded = encodeReceiptLedgerPayload(entries)
    expect(encoded.payload).toBeNull()
    expect(encoded.partCount).toBeGreaterThan(1)
    expect(encoded.parts).toHaveLength(encoded.partCount)
    expect(encoded.parts.every((part) => part.byteLength <= JSON_PAYLOAD_CHUNK_MAX_BYTES)).toBe(
      true
    )
    expect(encoded.byteLength).toBe(new TextEncoder().encode(canonicalizeJson(entries)).byteLength)
    expect(decodeReceiptLedgerPayload(encoded)).toEqual(entries)
  })

  it('rejects empty and wholly tombstoned payloads, duplicate identities, and mismatched keys', () => {
    const entry = characterReceipt()
    expect(() => encodeReceiptLedgerPayload([])).toThrow()
    expect(() => encodeReceiptLedgerPayload([null, null])).toThrow()
    expect(() => encodeReceiptLedgerPayload([entry, null, structuredClone(entry)])).toThrow(
      /duplicated/
    )
    expect(() => encodeReceiptLedgerPayload([{ ...entry, key: [characterId, uuid(999)] }])).toThrow(
      /identity/
    )
    expect(() =>
      decodeReceiptLedgerPayload(encodedBody(canonicalizeJson([entry, entry]), 2))
    ).toThrow(/duplicated/)
    expect(() => decodeReceiptLedgerPayload(encodedBody('[null]', 1))).toThrow(/no live/)
  })

  it('checks the entire normalized value and stored row contract', () => {
    const entry = characterReceipt()
    const changed = { ...entry, value: { ...entry.value, actorId: uuid(999) } }
    expect(() => encodeReceiptLedgerPayload([changed])).toThrow(/checksum/)
    const invalid = { ...entry, value: { ...entry.value, occurredAt: 'invalid' } }
    invalid.checksum = checksumCanonicalJson(invalid.value)
    expect(() => encodeReceiptLedgerPayload([invalid])).toThrow()
    expect(() => decodeReceiptLedgerPayload(encodedBody(canonicalizeJson([invalid]), 1))).toThrow()
  })

  it('rejects changed bytes, body SHA, slot count, and noncanonical JSON even with a matching SHA', () => {
    const entries = [characterReceipt(), characterReceipt(2)]
    const encoded = encodeReceiptLedgerPayload(entries)
    expect(() => decodeReceiptLedgerPayload({ ...encoded, checksum: sha256Hex('wrong') })).toThrow(
      /checksum/
    )
    expect(() => decodeReceiptLedgerPayload({ ...encoded, entryCount: 3 })).toThrow(/count/)
    expect(() =>
      decodeReceiptLedgerPayload({ ...encoded, byteLength: encoded.byteLength + 1 })
    ).toThrow(/byte length/)
    expect(() =>
      decodeReceiptLedgerPayload({ ...encoded, byteLength: Number.MAX_SAFE_INTEGER })
    ).toThrow()
    const bytes = encoded.payload!.slice(0)
    const view = new Uint8Array(bytes)
    view[1] = view[1]! ^ 1
    expect(() => decodeReceiptLedgerPayload({ ...encoded, payload: bytes })).toThrow(/checksum/)
    expect(() =>
      decodeReceiptLedgerPayload(encodedBody(JSON.stringify(entries, null, 2), 2))
    ).toThrow(/canonical/)
    expect(() =>
      decodeReceiptLedgerPayload(encodedBody(canonicalizeJson(entries.reverse()), 2))
    ).not.toThrow()
    const reversed = encodedBody(canonicalizeJson(entries), 2)
    expect(() => decodeReceiptLedgerPayload({ ...reversed, checksum: encoded.checksum })).toThrow(
      /checksum/
    )
  })

  it('rejects invalid part counts, mixed inline/parts, sparse, oversized, reordered, and missing chunks', () => {
    const small = encodeReceiptLedgerPayload([characterReceipt()])
    const large = encodeReceiptLedgerPayload([characterReceipt(1, { text: '🐉'.repeat(100_000) })])
    expect(() => decodeReceiptLedgerPayload({ ...small, parts: [small.payload!] })).toThrow()
    expect(() => decodeReceiptLedgerPayload({ ...large, payload: small.payload })).toThrow()
    expect(() => decodeReceiptLedgerPayload({ ...large, partCount: 1 })).toThrow()
    expect(() => decodeReceiptLedgerPayload({ ...large, partCount: -1 })).toThrow()
    expect(() => decodeReceiptLedgerPayload({ ...large, parts: large.parts.slice(1) })).toThrow()
    expect(() =>
      decodeReceiptLedgerPayload({ ...large, parts: [...large.parts].reverse() })
    ).toThrow()
    expect(() =>
      decodeReceiptLedgerPayload({
        ...large,
        parts: [new ArrayBuffer(JSON_PAYLOAD_CHUNK_MAX_BYTES + 1), ...large.parts.slice(1)]
      })
    ).toThrow()
    expect(() => decodeReceiptLedgerPayload({ ...small, payload: new ArrayBuffer(0) })).toThrow()
    const sparse = [...large.parts]
    delete sparse[0]
    expect(() => decodeReceiptLedgerPayload({ ...large, parts: sparse })).toThrow(/sparse/)
  })

  it('rejects malformed UTF-8 before parsing and validates scalar metadata', () => {
    const encoded = encodeReceiptLedgerPayload([characterReceipt()])
    expect(() =>
      decodeReceiptLedgerPayload({
        ...encoded,
        payload: new Uint8Array([0xc3, 0x28]).buffer,
        byteLength: 2
      })
    ).toThrow(/UTF-8/)
    const bom = new Uint8Array(encoded.byteLength + 3)
    bom.set([0xef, 0xbb, 0xbf])
    bom.set(new Uint8Array(encoded.payload!), 3)
    expect(() =>
      decodeReceiptLedgerPayload({ ...encoded, payload: bom.buffer, byteLength: bom.byteLength })
    ).toThrow()
    expect(() => decodeReceiptLedgerPayload({ ...encoded, entryCount: 0 })).toThrow()
    expect(() => decodeReceiptLedgerPayload({ ...encoded, checksum: 'not a checksum' })).toThrow()
  })

  it('refuses accessors without invoking them and preserves own prototype-like domain JSON keys', () => {
    let invoked = false
    const entry = characterReceipt()
    const getter = () => {
      invoked = true
      return entry.value
    }
    Object.defineProperty(entry, 'value', { enumerable: true, get: getter })
    expect(() => encodeReceiptLedgerPayload([entry])).toThrow()
    const encoded = encodeReceiptLedgerPayload([characterReceipt()])
    Object.defineProperty(encoded, 'payload', {
      enumerable: true,
      get() {
        invoked = true
        return null
      }
    })
    expect(() => decodeReceiptLedgerPayload(encoded)).toThrow()
    expect(invoked).toBe(false)
    const history = canonicalJsonRecordSchema.parse(
      JSON.parse('{"__proto__":{"kept":true},"constructor":1}')
    )
    const safe = characterReceipt(1, history)
    expect(decodeReceiptLedgerPayload(encodeReceiptLedgerPayload([safe]))).toEqual([safe])
    expect(Object.getPrototypeOf(history)).toBe(Object.prototype)
    const inherited = Object.setPrototypeOf({ ...safe.value }, { poison: true })
    expect(() => encodeReceiptLedgerPayload([{ ...safe, value: inherited }])).toThrow()
  })

  it('keeps tombstone slot indexes stable and refuses replay of a deleted slot', () => {
    const entries = [characterReceipt(), characterReceipt(2), characterReceipt(3)]
    const encoded = encodeReceiptLedgerPayload([entries[0]!, null, entries[2]!])
    const decoded = decodeReceiptLedgerPayload(encoded)
    expect(decoded).toEqual([entries[0], null, entries[2]])
    const metadata = { ...head(encoded), scope: 'CHARACTER' as const, scopeId: characterId }
    expect(readReceiptLedgerEntry(metadata, decoded, pointer(entries[2]!, 2), entries[2]!)).toEqual(
      entries[2]
    )
    expect(() =>
      readReceiptLedgerEntry(metadata, decoded, pointer(entries[1]!, 1), entries[1]!)
    ).toThrow(/deleted/)
  })

  it('verifies pointer ledger, index, checksum, expected identity, and Campaign scope', () => {
    const entry = encounterEntries()[0]!
    const encoded = encodeReceiptLedgerPayload([entry])
    const metadata = head(encoded)
    const reference = pointer(entry)
    expect(readReceiptLedgerEntry(metadata, [entry], reference, entry)).toEqual(entry)
    expect(() =>
      readReceiptLedgerEntry(metadata, [entry], { ...reference, ledgerId: uuid(999) }, entry)
    ).toThrow()
    expect(() =>
      readReceiptLedgerEntry(metadata, [entry], { ...reference, entryIndex: 1 }, entry)
    ).toThrow()
    expect(() =>
      readReceiptLedgerEntry(
        metadata,
        [entry],
        { ...reference, entryChecksum: sha256Hex('wrong') },
        entry
      )
    ).toThrow()
    expect(() =>
      readReceiptLedgerEntry(metadata, [entry], reference, {
        table: entry.table,
        key: [campaignId, uuid(999)]
      })
    ).toThrow()
    expect(() =>
      readReceiptLedgerEntry(metadata, [entry], reference, {
        table: 'encounterRuleReceipts',
        key: entry.key
      })
    ).toThrow()
    expect(() =>
      readReceiptLedgerEntry({ ...metadata, scopeId: uuid(999) }, [entry], reference, entry)
    ).toThrow(/scope/)
    expect(
      readReceiptLedgerEntry({ ...metadata, checkpointId: uuid(999) }, [entry], reference, entry)
    ).toEqual(entry)
    const changed = { ...entry, value: { ...entry.value, actorUserId: uuid(999) } }
    expect(() => readReceiptLedgerEntry(metadata, [changed], reference, entry)).toThrow(/checksum/)
  })

  it('restricts each ledger to its owner and allows Character checkpoint metadata', () => {
    const entry = characterReceipt()
    const encoded = encodeReceiptLedgerPayload([entry])
    const metadata: ReceiptLedgerMetadata = {
      ...head(encoded),
      scope: 'CHARACTER',
      scopeId: characterId,
      epoch: uuid(21),
      checkpointId: uuid(23)
    }
    expect(readReceiptLedgerEntry(metadata, [entry], pointer(entry), entry)).toEqual(entry)
    expect(() => readReceiptLedgerEntry(head(encoded), [entry], pointer(entry), entry)).toThrow(
      /scope/
    )
    expect(() =>
      readReceiptLedgerEntry({ ...metadata, scopeId: uuid(999) }, [entry], pointer(entry), entry)
    ).toThrow(/scope/)
    const encounter = encounterEntries()[0]!
    expect(() =>
      readReceiptLedgerEntry(metadata, [encounter], pointer(encounter), encounter)
    ).toThrow(/scope/)
    expect(() => receiptLedgerMetadataSchema.parse({ ...metadata, epoch: null })).toThrow()
    expect(() => receiptLedgerMetadataSchema.parse({ ...metadata, checkpointId: null })).toThrow()
    expect(
      receiptLedgerMetadataSchema.parse({ ...metadata, epoch: null, checkpointId: null })
    ).toMatchObject({ scope: 'CHARACTER', scopeId: characterId })
  })
})
