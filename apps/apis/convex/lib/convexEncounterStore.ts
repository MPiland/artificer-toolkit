import type {
  IndexNames,
  OrderedQuery,
  Query,
  QueryInitializer,
  WithoutSystemFields
} from 'convex/server'
import {
  receiptHeaderSchemas,
  type ReceiptHeaderTable
} from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import {
  encounterStoreIndexes,
  encounterStoreSchemas,
  type EncounterStoreDocuments
} from '@artificer-toolkit/schema/projections/encounterStore'
import type {
  EncounterDocument,
  EncounterId,
  EncounterOrderedQuery,
  EncounterQuery,
  EncounterQueryInitializer,
  EncounterStore,
  EncounterStoreReader,
  EncounterTableName
} from '@artificer-toolkit/encounter-persistence/store'
import type { DataModel, Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  deleteReceiptHeaders,
  readReceiptHeader,
  readReceiptHeaders,
  readReceiptLedger,
  writeReceiptRecord,
  type ReceiptLedgerLoader,
  type ReceiptHeaderRef
} from './receiptLedgers'

/** Room-only store tables (D88): Convex holds no such table, so the Convex store refuses them. */
type RoomOnlyEncounterTable = 'encounterEvidenceRolls'

type NativeEncounterTable = Exclude<EncounterTableName, ReceiptHeaderTable | RoomOnlyEncounterTable>

function isRoomOnlyTable(table: EncounterTableName): table is RoomOnlyEncounterTable {
  return table === 'encounterEvidenceRolls'
}

function isHistoryTable(table: EncounterTableName): table is ReceiptHeaderTable {
  return Object.hasOwn(receiptHeaderSchemas, table)
}

function historyTableForId(ctx: QueryCtx, id: string): ReceiptHeaderTable | null {
  for (const table of Object.keys(receiptHeaderSchemas) as ReceiptHeaderTable[])
    if (ctx.db.normalizeId(table, id)) return table
  return null
}

function historyOrderedQuery<Table extends ReceiptHeaderTable>(
  ctx: QueryCtx,
  table: Table,
  native: OrderedQuery<DataModel[Table]>,
  loadLedger: ReceiptLedgerLoader
): EncounterOrderedQuery<EncounterDocument<Table>> {
  return {
    collect: async () => readReceiptHeaders(ctx, table, await native.collect(), loadLedger),
    take: async (count) => readReceiptHeaders(ctx, table, await native.take(count), loadLedger),
    first: async () => {
      const header = await native.first()
      return header ? readReceiptHeader(ctx, table, header, loadLedger) : null
    },
    unique: async () => {
      // Native unique refuses duplicates before loading any ledger payload.
      const header = await native.unique()
      return header ? readReceiptHeader(ctx, table, header, loadLedger) : null
    },
    async *[Symbol.asyncIterator]() {
      // Preserve native lazy iteration and early cancellation; no complete-range allocation.
      for await (const header of native)
        yield await readReceiptHeader(ctx, table, header, loadLedger)
    }
  }
}

function historyQuery<Table extends ReceiptHeaderTable>(
  ctx: QueryCtx,
  table: Table,
  native: Query<DataModel[Table]>,
  loadLedger: ReceiptLedgerLoader
): EncounterQuery<EncounterDocument<Table>> {
  return {
    ...historyOrderedQuery(ctx, table, native, loadLedger),
    order: (order) => historyOrderedQuery(ctx, table, native.order(order), loadLedger)
  }
}

function historyQueryInitializer<Table extends ReceiptHeaderTable>(
  ctx: QueryCtx,
  table: Table,
  loadLedger: ReceiptLedgerLoader
): EncounterQueryInitializer<Table> {
  const native = ctx.db.query(table)
  type NativeRange = Parameters<QueryInitializer<DataModel[Table]>['withIndex']>[1]
  const initializer = {
    ...historyQuery(ctx, table, native, loadLedger),
    withIndex: (index: string, range?: NativeRange) => {
      if (!Object.hasOwn(encounterStoreIndexes[table], index))
        throw new Error('Encounter receipt index is unavailable.')
      // The validated logical index uses the unchanged scalar fields of the physical header.
      return historyQuery(
        ctx,
        table,
        native.withIndex(index as IndexNames<DataModel[Table]>, range),
        loadLedger
      )
    }
  }
  // Native index callbacks consume the same scalar builder and return Convex's opaque range.
  // Restore the existing per-table/index overloads after validating index names on each call.
  return initializer as EncounterQueryInitializer<Table>
}

/** Explicit package seam only. Caller owns authority/privacy; native app queries keep ctx.db. */
export function createConvexEncounterStoreReader(ctx: QueryCtx): EncounterStoreReader {
  const loadLedger = readReceiptLedger
  async function get<Table extends EncounterTableName>(
    id: EncounterId<Table>
  ): Promise<EncounterDocument<Table> | null> {
    const table = historyTableForId(ctx, id)
    if (table) {
      const nativeId = ctx.db.normalizeId(table, id)
      if (!nativeId) throw new Error('Encounter receipt native identity is invalid.')
      const header = await ctx.db.get(nativeId)
      if (!header) return null
      const document = await readReceiptHeader(ctx, table, header, loadLedger)
      // normalizeId checked the requested native family; hydration checked its complete body.
      return document as unknown as EncounterDocument<Table>
    }
    const document = await ctx.db.get(id as Id<NativeEncounterTable>)
    // Four native-family checks exclude physical headers. All other logical/native shapes agree.
    return document as EncounterDocument<Table> | null
  }

  function query<Table extends EncounterTableName>(table: Table): EncounterQueryInitializer<Table> {
    if (!Object.hasOwn(encounterStoreSchemas, table) || isRoomOnlyTable(table))
      throw new Error('Encounter store table is unavailable.')
    if (isHistoryTable(table)) {
      const query = historyQueryInitializer(ctx, table, loadLedger)
      // Runtime table selection preserves the caller's generic table and existing overloads.
      return query as EncounterQueryInitializer<Table>
    }
    // Validated non-history tables retain the native document and index contracts unchanged.
    return ctx.db.query(table) as unknown as EncounterQueryInitializer<Table>
  }

  return { get, query }
}

/** All writes use the caller's current native mutation; integrity failures must escape it. */
export function createConvexEncounterStore(ctx: MutationCtx): EncounterStore {
  async function insert<Table extends EncounterTableName>(
    table: Table,
    value: EncounterStoreDocuments[Table]
  ): Promise<EncounterId<Table>> {
    if (!Object.hasOwn(encounterStoreSchemas, table) || isRoomOnlyTable(table))
      throw new Error('Encounter store table is unavailable.')
    if (isHistoryTable(table)) {
      const logical = encounterStoreSchemas[table].parse(
        value
      ) as EncounterStoreDocuments[typeof table]
      const id = await writeReceiptRecord(ctx, table, logical)
      // writeReceiptRecord validates the row and normalizeId checks the inserted native family.
      return id as EncounterId<Table>
    }
    const logical = encounterStoreSchemas[table].parse(value)
    // The table-selected shared contract is the unchanged non-history physical row contract.
    const id = await ctx.db.insert(
      table as NativeEncounterTable,
      logical as WithoutSystemFields<Doc<NativeEncounterTable>>
    )
    return id as EncounterId<Table>
  }

  async function patch<Table extends EncounterTableName>(
    id: EncounterId<Table>,
    value: Partial<EncounterStoreDocuments[Table]>
  ): Promise<void> {
    if (historyTableForId(ctx, id)) throw new Error('Encounter receipt bodies are immutable.')
    // Routing excludes every physical header. Native patch validates fields and keeps undefined removal.
    await ctx.db.patch(
      id as Id<NativeEncounterTable>,
      value as Partial<WithoutSystemFields<Doc<NativeEncounterTable>>>
    )
  }

  async function replace<Table extends EncounterTableName>(
    id: EncounterId<Table>,
    value: EncounterStoreDocuments[Table]
  ): Promise<void> {
    if (historyTableForId(ctx, id)) throw new Error('Encounter receipt bodies are immutable.')
    // Routing excludes every physical header; native schema validation precedes the replacement.
    await ctx.db.replace(
      id as Id<NativeEncounterTable>,
      value as WithoutSystemFields<Doc<NativeEncounterTable>>
    )
  }

  async function remove(id: EncounterId<EncounterTableName>): Promise<void> {
    const table = historyTableForId(ctx, id)
    if (!table) return ctx.db.delete(id as Id<NativeEncounterTable>)
    const nativeId = ctx.db.normalizeId(table, id)
    if (!nativeId) throw new Error('Encounter receipt native identity is invalid.')
    const header = await ctx.db.get(nativeId)
    if (!header) return ctx.db.delete(nativeId)
    const { _id, _creationTime, ...fields } = header
    receiptHeaderSchemas[table].parse(fields)
    // Native family and table-selected scalar schema are validated before restoring correlation.
    await deleteReceiptHeaders(ctx, [{ table, header } as ReceiptHeaderRef])
  }

  return { ...createConvexEncounterStoreReader(ctx), insert, patch, replace, delete: remove }
}
