import { createServerFn } from '@tanstack/react-start'
import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '#supabase/server.server'

export interface AuthSessionSnapshot {
  user: User | null
  accessToken: string | null
}

export const loadCurrentSessionFn = createServerFn({ method: 'GET' }).handler(async (): Promise<AuthSessionSnapshot> => {
  const supabase = getSupabaseServerClient()
  const { data: userData } = await supabase.auth.getUser()
  const { data: sessionData } = await supabase.auth.getSession()

  return {
    user: userData.user ?? null,
    accessToken: sessionData.session?.access_token ?? null
  }
})
