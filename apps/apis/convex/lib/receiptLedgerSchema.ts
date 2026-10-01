import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  receiptLedgerMetadataSchema,
  receiptLedgerPartMetadataSchema,
  characterReceiptPurgeJobSchema
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'

export const receiptLedgerTables = {
  receiptLedgers: defineTable({
    ...zodToConvexFields(receiptLedgerMetadataSchema.shape),
    payload: v.union(v.bytes(), v.null())
  })
    .index('by_publicId', ['id'])
    .index('by_scope_scopeId', ['scope', 'scopeId']),
  receiptLedgerParts: defineTable({
    ...zodToConvexFields(receiptLedgerPartMetadataSchema.shape),
    bytes: v.bytes()
  }).index('by_ledgerId_index', ['ledgerId', 'index']),
  characterReceiptPurgeJobs: defineTable(
    zodToConvexFields(characterReceiptPurgeJobSchema.shape)
  ).index('by_characterId', ['characterId'])
}
