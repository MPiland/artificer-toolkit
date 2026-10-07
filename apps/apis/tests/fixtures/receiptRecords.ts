import {
  encodeReceiptLedgerPayload,
  projectReceiptHeader
} from '@artificer-toolkit/encounter-persistence/receiptLedger'
import {
  receiptLedgerEntrySchema,
  receiptLedgerEntryKeyFields
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  encounterStoreSchemas,
  type EncounterStoreDocuments
} from '@artificer-toolkit/schema/projections/encounterStore'
import {
  receiptHeaderSchemas,
  type ReceiptHeaderTable
} from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { MutationCtx } from '../../convex/_generated/server'
import { readReceiptHeader, readReceiptLedger } from '../../convex/lib/receiptLedgers'

/** Changes logical history while keeping its physical envelope and stable header slot valid. */
export async function replaceReceiptRecord<Table extends ReceiptHeaderTable>(
  ctx: MutationCtx,
  table: Table,
  headerNativeId: Id<Table>,
  logicalPatch: Partial<EncounterStoreDocuments[Table]>
) {
  const header = await ctx.db.get(headerNativeId)
  if (!header) throw new Error('Receipt fixture header is unavailable.')
  const { _id, _creationTime, ...logical } = await readReceiptHeader(ctx, table, header)
  const stored = encounterStoreSchemas[table].parse({ ...logical, ...logicalPatch })
  const value = canonicalJsonRecordSchema.parse(
    Object.fromEntries(
      Object.entries(stored)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => {
          if (!field.endsWith('Json') || value === null) return [field, value]
          if (typeof value !== 'string') throw new Error('Receipt fixture JSON field is invalid.')
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
  const ledger = await readReceiptLedger(ctx, header.ledgerId)
  const entries = [...ledger.entries]
  entries[header.entryIndex] = entry
  const { payload, parts, ...metadata } = encodeReceiptLedgerPayload(entries)
  const replacementHead = { ...ledger.metadata, ...metadata, payload }
  await ctx.db.replace(ledger.head._id, replacementHead)
  for (const part of ledger.parts) await ctx.db.delete(part._id)
  const replacementParts: Doc<'receiptLedgerParts'>[] = []
  for (const [index, bytes] of parts.entries()) {
    const id = await ctx.db.insert('receiptLedgerParts', {
      ledgerId: header.ledgerId,
      index,
      bytes
    })
    const part = await ctx.db.get(id)
    if (!part) throw new Error('Receipt fixture part is unavailable.')
    replacementParts.push(part)
  }
  const projected = projectReceiptHeader(entry, {
    ledgerId: header.ledgerId,
    entryIndex: header.entryIndex,
    entryChecksum: entry.checksum
  })
  switch (table) {
    case 'characterCommandReceipts': {
      const id = ctx.db.normalizeId('characterCommandReceipts', headerNativeId)
      if (!id) throw new Error('Receipt fixture header identity is invalid.')
      await ctx.db.replace(id, receiptHeaderSchemas.characterCommandReceipts.parse(projected))
      break
    }
    case 'encounterRunCommands': {
      const id = ctx.db.normalizeId('encounterRunCommands', headerNativeId)
      if (!id) throw new Error('Receipt fixture header identity is invalid.')
      await ctx.db.replace(id, receiptHeaderSchemas.encounterRunCommands.parse(projected))
      break
    }
    case 'encounterRuleReceipts': {
      const id = ctx.db.normalizeId('encounterRuleReceipts', headerNativeId)
      if (!id) throw new Error('Receipt fixture header identity is invalid.')
      await ctx.db.replace(id, receiptHeaderSchemas.encounterRuleReceipts.parse(projected))
    }
  }
  // Multiple deliberate edits in one fixture transaction may share the same ledger.
  ledger.entries = entries
  ledger.metadata = { ...ledger.metadata, ...metadata }
  ledger.head = { ...ledger.head, ...replacementHead }
  ledger.parts = replacementParts
}
