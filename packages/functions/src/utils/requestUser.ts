import { createSupabaseClient } from '../clients/supabaseClient.js'

export async function resolveRequestUserId(request: Request): Promise<string | null> {
  const jwt = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!jwt) {
    return null
  }

  const supabase = createSupabaseClient()
  const { data, error } = await supabase.auth.getUser(jwt)
  if (error || !data.user) {
    return null
  }

  return data.user.id
}
