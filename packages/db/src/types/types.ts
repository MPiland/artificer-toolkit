import type { KyselifyDatabase } from 'kysely-supabase'
import type { Database as SupabaseDatabase } from './database'

export type Database = KyselifyDatabase<SupabaseDatabase>
