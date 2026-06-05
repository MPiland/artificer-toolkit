import type { QueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'

export interface AppRouterContext {
  nonce?: string
  queryClient: QueryClient
  user: User | null
}

export function createAppRouterContext(context: AppRouterContext): AppRouterContext {
  return context
}
