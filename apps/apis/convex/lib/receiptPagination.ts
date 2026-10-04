import type { OrderedQuery, PaginationOptions, PaginationResult } from 'convex/server'
import type { ReceiptHeaderTable } from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import { RECEIPT_LEDGER_MAX_BYTES } from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import type { DataModel } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import {
  readReceiptHeaders,
  readReceiptLedgerMetadata,
  type HydratedReceiptHeader
} from './receiptLedgers'

/** Caller owns the indexed range and authority checks. Preserve Convex's complete native page. */
export async function paginateReceiptHeaders<Table extends ReceiptHeaderTable>(
  ctx: QueryCtx,
  table: Table,
  query: OrderedQuery<DataModel[Table]>,
  options: PaginationOptions
): Promise<PaginationResult<HydratedReceiptHeader<Table>>> {
  if (
    options.maximumRowsRead !== undefined &&
    (!Number.isSafeInteger(options.maximumRowsRead) || options.maximumRowsRead < 1)
  )
    throw new Error('Receipt pagination scan limit is invalid.')
  const result = await query.paginate({
    ...options,
    numItems: Math.min(options.numItems, 1),
    maximumRowsRead: 1
  })
  // Native end-cursor windows (including reactive journals) ignore the requested scan limits.
  // Validate the whole returned window before loading any multipart body; never truncate its cursor.
  let payloadBytes = 0
  const ledgers = new Set<string>()
  for (const header of result.page) {
    if (ledgers.has(header.ledgerId)) continue
    ledgers.add(header.ledgerId)
    payloadBytes += (await readReceiptLedgerMetadata(ctx, header.ledgerId)).byteLength
    if (payloadBytes > RECEIPT_LEDGER_MAX_BYTES)
      throw new Error('Receipt pagination window exceeds the payload read limit.')
  }
  return { ...result, page: await readReceiptHeaders(ctx, table, result.page) }
}
