import { getCookies, setCookie } from '@tanstack/react-start/server'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseDatabase } from '@artificer-toolkit/db/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseServerClient(): SupabaseClient<SupabaseDatabase> {
  return createServerClient<SupabaseDatabase>(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value
        }))
      },
      setAll(cookies) {
        cookies.forEach((cookie) => setCookie(cookie.name, cookie.value, cookie.options))
      }
    }
  })
}
