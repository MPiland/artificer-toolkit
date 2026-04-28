import { getSupabaseServerClient } from './server.server'

// Helper: get authenticated user for RLS.
export async function getAuthUser() {
  const supabase = getSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}
