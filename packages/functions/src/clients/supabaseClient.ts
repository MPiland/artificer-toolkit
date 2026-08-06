import { createClient } from '@supabase/supabase-js'

export const createSupabaseClient = (forwardedFor?: string) =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    forwardedFor
      ? {
          global: {
            headers: { 'sb-forwarded-for': forwardedFor }
          }
        }
      : undefined
  )
