import type { QueryClient } from '@tanstack/react-query'
import type { ApplicationFeatureFlagsDto } from '@artificer-toolkit/schema/api/applicationConfig'
import type { User } from '@supabase/supabase-js'

export interface AppRouterContext {
  featureFlags?: ApplicationFeatureFlagsDto
  nonce?: string
  queryClient: QueryClient
  user: User | null
}

export function createAppRouterContext(context: AppRouterContext): AppRouterContext {
  return context
}
