import type { KyselifyDatabase } from 'kysely-supabase'
import type { Database as SupabaseDatabase } from './supabase.database.js'

export type Database = KyselifyDatabase<SupabaseDatabase>
export type DB = Database
export type { Json } from './supabase.database.js'
