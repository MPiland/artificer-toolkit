import type { IndexRange } from 'convex/server'
import type { EncounterStoreDocuments } from './storeTables.js'
import type { encounterStoreIndexes } from './storeTables.js'

/**
 * The document store the Encounter persistence code runs against: the subset of Convex's
 * transaction database handle it uses, over the same table and index names. The Convex adapter
 * is `ctx.db` itself; the room provides its own store later (ADR 0035).
 *
 * `IndexRange` is Convex's opaque range type: a callback's result is only ever returned to the
 * store that built it, and naming the same type lets `ctx.db` satisfy this interface unchanged.
 */
export type EncounterTableName = keyof EncounterStoreDocuments

export type EncounterId<Table extends EncounterTableName> = string & { __tableName: Table }

export type EncounterDocument<Table extends EncounterTableName> = EncounterStoreDocuments[Table] & {
  _id: EncounterId<Table>
  _creationTime: number
}

type IndexName<Table extends EncounterTableName> = keyof (typeof encounterStoreIndexes)[Table] &
  string

/** An index's fields, ending with the creation-time tiebreaker every index carries. */
type IndexFields<
  Table extends EncounterTableName,
  Index extends IndexName<Table>
> = ((typeof encounterStoreIndexes)[Table][Index] extends infer Fields extends readonly string[]
  ? readonly [...Fields, '_creationTime']
  : never) &
  readonly (keyof EncounterDocument<Table>)[]

interface UpperBoundBuilder<Document, Field extends keyof Document> extends IndexRange {
  lt(field: Field, value: Document[Field]): IndexRange
  lte(field: Field, value: Document[Field]): IndexRange
}

interface LowerBoundBuilder<Document, Field extends keyof Document> extends UpperBoundBuilder<
  Document,
  Field
> {
  gt(field: Field, value: Document[Field]): UpperBoundBuilder<Document, Field>
  gte(field: Field, value: Document[Field]): UpperBoundBuilder<Document, Field>
}

type PlusOne<Position extends number> = [1, 2, 3, 4, 5, 6, 7, 8][Position]

type NextRangeBuilder<
  Document,
  Fields extends readonly (keyof Document)[],
  Position extends number
> =
  PlusOne<Position> extends Fields['length']
    ? IndexRange
    : EncounterIndexRangeBuilder<Document, Fields, PlusOne<Position>>

/** Equality on an index's leading fields, then at most one bounded range on the next. */
export interface EncounterIndexRangeBuilder<
  Document,
  Fields extends readonly (keyof Document)[],
  Position extends number = 0
> extends LowerBoundBuilder<Document, Fields[Position]> {
  eq(
    field: Fields[Position],
    value: Document[Fields[Position]]
  ): NextRangeBuilder<Document, Fields, Position>
}

export interface EncounterOrderedQuery<Document> {
  collect(): Promise<Document[]>
  take(count: number): Promise<Document[]>
  first(): Promise<Document | null>
  /** The only matching document; more than one is an error. */
  unique(): Promise<Document | null>
  [Symbol.asyncIterator](): AsyncIterator<Document>
}

export interface EncounterQuery<Document> extends EncounterOrderedQuery<Document> {
  order(order: 'asc' | 'desc'): EncounterOrderedQuery<Document>
}

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection
) => void
  ? Intersection
  : never

/**
 * One overload per table and index. Convex's handle is generic over table and index names; a
 * concrete overload per name is what lets it satisfy this interface without a cast.
 */
type WithIndex<Table extends EncounterTableName> = UnionToIntersection<
  {
    [Index in IndexName<Table>]: (
      index: Index,
      range?: (
        query: EncounterIndexRangeBuilder<EncounterDocument<Table>, IndexFields<Table, Index>>
      ) => IndexRange
    ) => EncounterQuery<EncounterDocument<Table>>
  }[IndexName<Table>]
>

export interface EncounterQueryInitializer<Table extends EncounterTableName> extends EncounterQuery<
  EncounterDocument<Table>
> {
  withIndex: WithIndex<Table>
}

type PerTable<Signature extends { [Table in EncounterTableName]: unknown }> = UnionToIntersection<
  Signature[EncounterTableName]
>

export interface EncounterStoreReader {
  get: PerTable<{
    [Table in EncounterTableName]: (
      id: EncounterId<Table>
    ) => Promise<EncounterDocument<Table> | null>
  }>
  query: PerTable<{
    [Table in EncounterTableName]: (table: Table) => EncounterQueryInitializer<Table>
  }>
}

export interface EncounterStore extends EncounterStoreReader {
  insert: PerTable<{
    [Table in EncounterTableName]: (
      table: Table,
      value: EncounterStoreDocuments[Table]
    ) => Promise<EncounterId<Table>>
  }>
  /** Shallow merge; a field set to `undefined` is removed. */
  patch: PerTable<{
    [Table in EncounterTableName]: (
      id: EncounterId<Table>,
      value: Partial<EncounterStoreDocuments[Table]>
    ) => Promise<void>
  }>
  replace: PerTable<{
    [Table in EncounterTableName]: (
      id: EncounterId<Table>,
      value: EncounterStoreDocuments[Table]
    ) => Promise<void>
  }>
  delete(id: EncounterId<EncounterTableName>): Promise<void>
}

/** A transaction that reads the Encounter store; Convex's query and mutation contexts satisfy it. */
export interface EncounterReadContext {
  readonly db: EncounterStoreReader
}

/** A transaction that also writes the Encounter store; Convex's mutation context satisfies it. */
export interface EncounterWriteContext {
  readonly db: EncounterStore
}
