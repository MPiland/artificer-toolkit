import { createClient } from '@supabase/supabase-js'
import type { SupabaseDatabase } from '@artificer-toolkit/db/types'

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error('Server-side Supabase credentials are required.')
  }

  return createClient<SupabaseDatabase>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
