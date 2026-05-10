import { createServerFn } from '@tanstack/react-start'
import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '#supabase/server.server'

export interface AuthSessionSnapshot {
  user: User | null
}

export const loadCurrentSessionFn = createServerFn({ method: 'GET' }).handler(async (): Promise<AuthSessionSnapshot> => {
  const supabase = getSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()

  return {
    user: userData.user ?? null
  }
})
