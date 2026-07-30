import type { QueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { getAccountProfileQuery } from './accountQueries'

export async function getAccountProfileRedirect({
  queryClient,
  user
}: {
  queryClient: QueryClient
  user: User | null
}): Promise<'invite' | 'sign-in' | null> {
  if (!user) return 'sign-in'

  const profile = await queryClient.ensureQueryData(getAccountProfileQuery(user.id))
  return profile ? null : 'invite'
}
