import type { OrderedQuery, PaginationOptions, PaginationResult } from 'convex/server'
import type { ReceiptHeaderTable } from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import { RECEIPT_LEDGER_MAX_BYTES } from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import {
  characterHistoryCursorSchema,
  type CharacterHistoryInput
} from '@artificer-toolkit/schema/api/characterHistory'
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

/** Character history uses indexed seeks instead of native reactive pagination windows. */
export async function readCharacterHistoryHeaders(
  ctx: QueryCtx,
  characterId: string,
  actorId: string,
  options: CharacterHistoryInput['paginationOpts']
) {
  const cursor =
    options.cursor === null ? null : characterHistoryCursorSchema.parse(JSON.parse(options.cursor))
  if (cursor && (cursor.characterId !== characterId || cursor.actorId !== actorId))
    throw new Error('Character history cursor belongs to another owner or Character.')
  const rows = cursor
    ? await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_actorId_occurredAt_id', (q) =>
          q
            .eq('characterId', characterId)
            .eq('actorId', actorId)
            .eq('occurredAt', cursor.occurredAt)
            .gt('id', cursor.id)
        )
        .take(2)
    : await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_actorId_occurredAt_id', (q) =>
          q.eq('characterId', characterId).eq('actorId', actorId)
        )
        .take(2)
  if (cursor && rows.length < 2)
    rows.push(
      ...(await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_actorId_occurredAt_id', (q) =>
          q
            .eq('characterId', characterId)
            .eq('actorId', actorId)
            .gt('occurredAt', cursor.occurredAt)
        )
        .take(2 - rows.length))
    )
  const header = rows[0]
  return {
    page: await readReceiptHeaders(ctx, 'characterCommandReceipts', header ? [header] : []),
    isDone: rows.length < 2,
    continueCursor: header
      ? JSON.stringify(
          characterHistoryCursorSchema.parse({
            version: 1,
            characterId,
            actorId,
            occurredAt: header.occurredAt,
            id: header.id
          })
        )
      : (options.cursor ?? '')
  }
}
