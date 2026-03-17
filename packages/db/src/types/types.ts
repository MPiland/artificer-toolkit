import type { Kysely, Transaction } from 'kysely'
import type { KyselifyDatabase } from 'kysely-supabase'
import type { Database as SupabaseDatabase } from './supabase.database.js'

export type { Json } from './supabase.database.js'
export type Database = KyselifyDatabase<SupabaseDatabase>
export type DB = Database
export type KyselyDatabase = Kysely<Database>
export type DBLike = Kysely<Database> | Transaction<Database>
export type DbTables = SupabaseDatabase['public']['Tables']
export type TableName = keyof DbTables
export type ColumnOf<K extends TableName> = keyof DbTables[K]['Row']
export type ColumnValueOf<
  K extends TableName,
  C extends ColumnOf<K>
> = SupabaseDatabase['public']['Tables'][K]['Row'][C]
