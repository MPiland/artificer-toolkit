import {
  receiptLedgerEntrySchema,
  receiptLedgerEntryKeyFields,
  type ReceiptLedgerEntry
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  encounterStoreSchemas,
  type EncounterStoreDocuments
} from '@artificer-toolkit/schema/projections/encounterStore'
import {
  receiptHeaderSchemas,
  type ReceiptHeaderDocuments,
  type ReceiptHeaderTable
} from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import {
  RECEIPT_LEDGER_MAX_BYTES,
  RECEIPT_LEDGER_MAX_ENTRIES,
  receiptLedgerMetadataSchema,
  receiptLedgerPartMetadataSchema,
  type ReceiptLedgerMetadata,
  type ReceiptLedgerPayloadMetadata
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import {
  decodeReceiptLedgerPayload,
  encodeReceiptLedgerPayload,
  projectReceiptHeader,
  readReceiptLedgerEntry,
  receiptLedgerEntryInScope
} from '@artificer-toolkit/encounter-persistence/receiptLedger'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export type ReceiptHeaderRef = {
  [Table in ReceiptHeaderTable]: { table: Table; header: Doc<Table> }
}[ReceiptHeaderTable]

export type InsertedReceiptHeader = {
  [Table in ReceiptHeaderTable]: {
    table: Table
    entryIndex: number
    id: Id<Table>
  }
}[ReceiptHeaderTable]

export type HydratedReceiptHeader<Table extends ReceiptHeaderTable> =
  EncounterStoreDocuments[Table] & { _id: Id<Table>; _creationTime: number }

export type DecodedReceiptLedger = {
  head: Doc<'receiptLedgers'>
  metadata: ReceiptLedgerMetadata
  entries: (ReceiptLedgerEntry | null)[]
  parts: Doc<'receiptLedgerParts'>[]
}

export type ReceiptLedgerLoader = (ctx: QueryCtx, ledgerId: string) => Promise<DecodedReceiptLedger>

const receiptLedgerReads = new WeakMap<QueryCtx, Map<string, Promise<DecodedReceiptLedger>>>()
type ValidatedReceiptLedgerHead = {
  head: Doc<'receiptLedgers'>
  metadata: ReceiptLedgerMetadata
}
const receiptLedgerHeadReads = new WeakMap<
  QueryCtx,
  Map<string, Promise<ValidatedReceiptLedgerHead>>
>()

/** Peeks validated head metadata without reading parts; the subsequent body read reuses this head. */
export async function readReceiptLedgerMetadata(
  ctx: QueryCtx,
  ledgerId: string
): Promise<ReceiptLedgerMetadata> {
  return (await readReceiptLedgerHead(ctx, ledgerId)).metadata
}

function readReceiptLedgerHead(
  ctx: QueryCtx,
  ledgerId: string
): Promise<ValidatedReceiptLedgerHead> {
  let reads = receiptLedgerHeadReads.get(ctx)
  if (!reads) {
    reads = new Map()
    receiptLedgerHeadReads.set(ctx, reads)
  }
  let head = reads.get(ledgerId)
  if (!head) {
    head = loadReceiptLedgerHead(ctx, ledgerId)
    reads.set(ledgerId, head)
  }
  return head
}

/** Caller owns authorization. Reads share one validated ledger promise per native transaction. */
export function readReceiptLedger(ctx: QueryCtx, ledgerId: string): Promise<DecodedReceiptLedger> {
  let reads = receiptLedgerReads.get(ctx)
  if (!reads) {
    reads = new Map()
    receiptLedgerReads.set(ctx, reads)
  }
  let ledger = reads.get(ledgerId)
  if (!ledger) {
    ledger = loadReceiptLedger(ctx, ledgerId)
    reads.set(ledgerId, ledger)
  }
  return ledger
}

async function loadReceiptLedgerHead(
  ctx: QueryCtx,
  ledgerId: string
): Promise<ValidatedReceiptLedgerHead> {
  const heads = await ctx.db
    .query('receiptLedgers')
    .withIndex('by_publicId', (q) => q.eq('id', ledgerId))
    .take(2)
  if (heads.length !== 1) throw new Error('Receipt ledger is missing or duplicated.')
  const head = heads[0]!
  const { _id, _creationTime, payload, ...fields } = head
  const metadata = receiptLedgerMetadataSchema.parse(fields)
  if (
    metadata.id !== ledgerId ||
    metadata.byteLength > RECEIPT_LEDGER_MAX_BYTES ||
    metadata.entryCount > RECEIPT_LEDGER_MAX_ENTRIES ||
    metadata.partCount > Math.ceil(RECEIPT_LEDGER_MAX_BYTES / JSON_PAYLOAD_CHUNK_MAX_BYTES)
  )
    throw new Error('Receipt ledger exceeds its storage bounds.')
  if (
    metadata.partCount === 0
      ? !(payload instanceof ArrayBuffer)
      : payload !== null || metadata.partCount < 2
  )
    throw new Error('Receipt ledger inline payload or parts are invalid.')
  return { head, metadata }
}

async function loadReceiptLedger(ctx: QueryCtx, ledgerId: string): Promise<DecodedReceiptLedger> {
  const { head, metadata } = await readReceiptLedgerHead(ctx, ledgerId)
  const parts = await ctx.db
    .query('receiptLedgerParts')
    .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', metadata.id))
    .order('asc')
    .take(metadata.partCount + 1)
  if (parts.length !== metadata.partCount)
    throw new Error('Receipt ledger parts are missing or duplicated.')
  for (let index = 0; index < parts.length; index++) {
    const { _id, _creationTime, bytes: _bytes, ...fields } = parts[index]!
    const part = receiptLedgerPartMetadataSchema.parse(fields)
    if (part.ledgerId !== metadata.id || part.index !== index)
      throw new Error('Receipt ledger parts are out of order or duplicated.')
  }
  const entries = decodeReceiptLedgerPayload({
    entryCount: metadata.entryCount,
    byteLength: metadata.byteLength,
    checksum: metadata.checksum,
    partCount: metadata.partCount,
    payload: head.payload,
    parts: parts.map((part) => part.bytes)
  })
  return { head, metadata, entries, parts }
}

function parseHeader<Table extends ReceiptHeaderTable>(table: Table, header: Doc<Table>) {
  const { _id, _creationTime, ...fields } = header
  const parsed = receiptHeaderSchemas[table].parse(fields)
  if (canonicalizeJson(parsed) !== canonicalizeJson(fields))
    throw new Error('Receipt header scalar metadata is not canonical.')
  // The table-selected schema validated this boundary before restoring its correlated type.
  return parsed as ReceiptHeaderDocuments[Table]
}

function hydrateHeader<Table extends ReceiptHeaderTable>(
  table: Table,
  header: Doc<Table>,
  ledger: DecodedReceiptLedger
): HydratedReceiptHeader<Table> {
  const parsed = parseHeader(table, header)
  const key = receiptLedgerEntryKeyFields[table].map((field) => {
    const value: unknown = Reflect.get(parsed, field)
    if (typeof value !== 'string' && typeof value !== 'number')
      throw new Error('Receipt header identity is incomplete.')
    return value
  })
  const pointer = {
    ledgerId: parsed.ledgerId,
    entryIndex: parsed.entryIndex,
    entryChecksum: parsed.entryChecksum
  }
  const entry = readReceiptLedgerEntry(ledger.metadata, ledger.entries, pointer, { table, key })
  if (canonicalizeJson(projectReceiptHeader(entry, pointer)) !== canonicalizeJson(parsed))
    throw new Error('Receipt header metadata does not match its ledger entry.')
  const stored = Object.fromEntries(
    Object.entries(entry.value).map(([field, value]) => [
      field,
      field.endsWith('Json') && value !== null ? canonicalizeJson(value) : value
    ])
  )
  const logical = encounterStoreSchemas[table].parse(stored)
  // Pointer family, identity, metadata and the table-selected logical schema are all validated.
  return {
    ...logical,
    _id: header._id,
    _creationTime: header._creationTime
  } as unknown as HydratedReceiptHeader<Table>
}

/** Caller must pass only ownership/privacy-approved headers. Each ledger is decoded once. */
export async function readReceiptHeaders<Table extends ReceiptHeaderTable>(
  ctx: QueryCtx,
  table: Table,
  headers: readonly Doc<Table>[],
  loadLedger: ReceiptLedgerLoader = readReceiptLedger
): Promise<HydratedReceiptHeader<Table>[]> {
  const groups = new Map<string, { header: Doc<Table>; index: number }[]>()
  for (const [index, header] of headers.entries()) {
    const parsed = parseHeader(table, header)
    const group = groups.get(parsed.ledgerId)
    if (group) group.push({ header, index })
    else groups.set(parsed.ledgerId, [{ header, index }])
  }
  const hydrated: HydratedReceiptHeader<Table>[] = []
  for (const [ledgerId, group] of groups) {
    const ledger = await loadLedger(ctx, ledgerId)
    for (const { header, index } of group) hydrated[index] = hydrateHeader(table, header, ledger)
  }
  return hydrated
}

/** Caller must check ownership/privacy before hydration. */
export async function readReceiptHeader<Table extends ReceiptHeaderTable>(
  ctx: QueryCtx,
  table: Table,
  header: Doc<Table>,
  loadLedger: ReceiptLedgerLoader = readReceiptLedger
): Promise<HydratedReceiptHeader<Table>> {
  return (await readReceiptHeaders(ctx, table, [header], loadLedger))[0]!
}

async function insertHeader(
  ctx: MutationCtx,
  entry: ReceiptLedgerEntry,
  ledgerId: string,
  entryIndex: number
): Promise<InsertedReceiptHeader> {
  const header = projectReceiptHeader(entry, {
    ledgerId,
    entryIndex,
    entryChecksum: entry.checksum
  })
  switch (entry.table) {
    case 'characterCommandReceipts': {
      const fields = receiptHeaderSchemas.characterCommandReceipts.parse(header)
      const collision = await ctx.db
        .query(entry.table)
        .withIndex('by_characterId_commandId', (q) =>
          q.eq('characterId', fields.characterId).eq('commandId', fields.commandId)
        )
        .take(1)
      if (collision.length) throw new Error('Receipt header identity already exists.')
      return { table: entry.table, entryIndex, id: await ctx.db.insert(entry.table, fields) }
    }
    case 'encounterRunCommands':
    case 'encounterRuleReceipts': {
      const fields = receiptHeaderSchemas[entry.table].parse(header)
      const collision = await ctx.db
        .query(entry.table)
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', fields.campaignId).eq('commandId', fields.commandId)
        )
        .take(1)
      if (collision.length) throw new Error('Receipt header identity already exists.')
      if (entry.table === 'encounterRunCommands')
        return {
          table: entry.table,
          entryIndex,
          id: await ctx.db.insert(
            entry.table,
            receiptHeaderSchemas.encounterRunCommands.parse(fields)
          )
        }
      return {
        table: entry.table,
        entryIndex,
        id: await ctx.db.insert(
          entry.table,
          receiptHeaderSchemas.encounterRuleReceipts.parse(fields)
        )
      }
    }
    case 'encounterEvidenceRolls': {
      const fields = receiptHeaderSchemas.encounterEvidenceRolls.parse(header)
      const commandCollision = await ctx.db
        .query(entry.table)
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', fields.campaignId).eq('commandId', fields.commandId)
        )
        .take(1)
      const idCollision = await ctx.db
        .query(entry.table)
        .withIndex('by_publicId', (q) => q.eq('id', fields.id))
        .take(1)
      if (commandCollision.length || idCollision.length)
        throw new Error('Receipt header identity already exists.')
      return { table: entry.table, entryIndex, id: await ctx.db.insert(entry.table, fields) }
    }
  }
}

/**
 * Runs inside the caller's mutation. Private Character and shared Campaign scopes stay separate;
 * the caller owns authority and any held Character association.
 */
export async function createReceiptLedger(
  ctx: MutationCtx,
  identity: Omit<ReceiptLedgerMetadata, keyof ReceiptLedgerPayloadMetadata>,
  entries: readonly (ReceiptLedgerEntry | null)[]
): Promise<InsertedReceiptHeader[]> {
  const encoded = encodeReceiptLedgerPayload(entries)
  const { payload, parts: buffers, ...payloadMetadata } = encoded
  const metadata = receiptLedgerMetadataSchema.parse({ ...identity, ...payloadMetadata })
  const decoded = decodeReceiptLedgerPayload(encoded)
  for (const entry of decoded) {
    if (entry && !receiptLedgerEntryInScope(metadata, entry))
      throw new Error('Receipt ledger entry scope does not match.')
  }
  const collision = await ctx.db
    .query('receiptLedgers')
    .withIndex('by_publicId', (q) => q.eq('id', metadata.id))
    .take(1)
  const orphanParts = await ctx.db
    .query('receiptLedgerParts')
    .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', metadata.id))
    .take(1)
  if (collision.length || orphanParts.length)
    throw new Error('Receipt ledger identity already exists.')
  // Refuse orphan headers as well: publishing a new body must never adopt a corrupt old pointer.
  for (const table of Object.keys(receiptHeaderSchemas) as ReceiptHeaderTable[]) {
    const orphanHeaders = await ctx.db
      .query(table)
      .withIndex('by_ledgerId_entryIndex', (q) => q.eq('ledgerId', metadata.id))
      .take(1)
    if (orphanHeaders.length) throw new Error('Receipt ledger has orphan headers.')
  }
  await ctx.db.insert('receiptLedgers', { ...metadata, payload })
  for (let index = 0; index < buffers.length; index++)
    await ctx.db.insert('receiptLedgerParts', {
      ledgerId: metadata.id,
      index,
      bytes: buffers[index]!
    })
  const headers: InsertedReceiptHeader[] = []
  for (let index = 0; index < decoded.length; index++) {
    const entry = decoded[index]
    if (entry) headers.push(await insertHeader(ctx, entry, metadata.id, index))
  }
  receiptLedgerReads.delete(ctx)
  receiptLedgerHeadReads.delete(ctx)
  return headers
}

/** One ordinary non-live logical receipt, sealed in the caller's native mutation. */
export async function writeReceiptRecord<Table extends ReceiptHeaderTable>(
  ctx: MutationCtx,
  table: Table,
  logicalRow: EncounterStoreDocuments[Table]
): Promise<Id<Table>> {
  const logical = encounterStoreSchemas[table].parse(logicalRow)
  const value = canonicalJsonRecordSchema.parse(
    Object.fromEntries(
      Object.entries(logical)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => {
          if (!field.endsWith('Json') || value === null) return [field, value]
          if (typeof value !== 'string') throw new Error('Receipt JSON storage field is invalid.')
          const decoded: unknown = JSON.parse(value)
          return [field, decoded]
        })
    )
  )
  const entry = receiptLedgerEntrySchema.parse({
    table,
    key: receiptLedgerEntryKeyFields[table].map((field) => value[field]),
    value,
    checksum: checksumCanonicalJson(value)
  })
  const character = table === 'characterCommandReceipts'
  const scopeId = value[character ? 'characterId' : 'campaignId']
  const createdAt = value[character ? 'occurredAt' : 'createdAt']
  if (typeof scopeId !== 'string' || typeof createdAt !== 'string')
    throw new Error('Receipt ledger scope or timestamp is invalid.')
  const headers = await createReceiptLedger(
    ctx,
    {
      id: crypto.randomUUID(),
      scope: character ? 'CHARACTER' : 'CAMPAIGN',
      scopeId,
      epoch: null,
      checkpointId: null,
      createdAt
    },
    [entry]
  )
  const header = headers[0]
  if (headers.length !== 1 || !header || header.table !== table || header.entryIndex !== 0)
    throw new Error('Receipt ledger header publication is inconsistent.')
  const id = ctx.db.normalizeId(table, header.id)
  if (!id) throw new Error('Receipt ledger header native identity is invalid.')
  return id
}

/** Caller selects authorized rows; all four families are verified before stable-slot cleanup. */
export async function deleteReceiptHeaders(ctx: MutationCtx, refs: readonly ReceiptHeaderRef[]) {
  const groups = new Map<string, ReceiptHeaderRef[]>()
  const selectedIds = new Set<string>()
  for (const ref of refs) {
    const parsed = parseHeader(ref.table, ref.header)
    if (selectedIds.has(ref.header._id)) throw new Error('Receipt cleanup reference is duplicated.')
    selectedIds.add(ref.header._id)
    const group = groups.get(parsed.ledgerId)
    if (group) group.push(ref)
    else groups.set(parsed.ledgerId, [ref])
  }
  for (const [ledgerId, selected] of groups) {
    const ledger = await readReceiptLedger(ctx, ledgerId)
    const remaining = [...ledger.entries]
    const selectedById = new Map(selected.map((ref) => [ref.header._id, ref]))
    const referencedSlots = new Set<number>()
    const foundSelected = new Set<string>()
    for (const table of Object.keys(receiptHeaderSchemas) as ReceiptHeaderTable[]) {
      const headers = await ctx.db
        .query(table)
        .withIndex('by_ledgerId_entryIndex', (q) => q.eq('ledgerId', ledgerId))
        .order('asc')
        .take(ledger.metadata.entryCount + 1)
      if (headers.length > ledger.metadata.entryCount)
        throw new Error('Receipt ledger has extra headers.')
      for (const header of headers) {
        hydrateHeader(table, header, ledger)
        if (referencedSlots.has(header.entryIndex))
          throw new Error('Receipt ledger slot has duplicate headers.')
        referencedSlots.add(header.entryIndex)
        if (selectedIds.has(header._id)) {
          const selectedRef = selectedById.get(header._id)
          if (
            !selectedRef ||
            selectedRef.table !== table ||
            canonicalizeJson(selectedRef.header) !== canonicalizeJson(header)
          )
            throw new Error('Receipt cleanup reference does not match the stored header.')
          foundSelected.add(header._id)
          remaining[header.entryIndex] = null
        }
      }
    }
    if (
      foundSelected.size !== selected.length ||
      ledger.entries.some((entry, index) => (entry !== null) !== referencedSlots.has(index))
    )
      throw new Error('Receipt ledger live slots do not match their headers.')
    const encoded = remaining.some((entry) => entry !== null)
      ? encodeReceiptLedgerPayload(remaining)
      : null
    for (const ref of selected) await ctx.db.delete(ref.header._id)
    for (const part of ledger.parts) await ctx.db.delete(part._id)
    if (encoded === null) {
      await ctx.db.delete(ledger.head._id)
      continue
    }
    const { payload, parts, ...payloadMetadata } = encoded
    await ctx.db.replace(ledger.head._id, { ...ledger.metadata, ...payloadMetadata, payload })
    for (let index = 0; index < parts.length; index++)
      await ctx.db.insert('receiptLedgerParts', { ledgerId, index, bytes: parts[index]! })
  }
  if (groups.size) {
    receiptLedgerReads.delete(ctx)
    receiptLedgerHeadReads.delete(ctx)
  }
}
