import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseDatabase } from '@artificer-toolkit/db/types'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient<SupabaseDatabase> | null = null

export function getSupabaseBrowserClient(): SupabaseClient<SupabaseDatabase> {
  if (_client) return _client

  _client = createBrowserClient<SupabaseDatabase>(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!)
  return _client
}
