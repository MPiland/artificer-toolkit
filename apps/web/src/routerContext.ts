import type { QueryClient } from '@tanstack/react-query'
import type { ApplicationFeatureFlagsDto } from '@artificer-toolkit/schema/api/applicationConfig'
import type { AuthSessionSnapshotDto, AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'

export interface AppRouterContext {
  featureFlags?: ApplicationFeatureFlagsDto
  isSuperAdmin?: boolean
  nonce?: string
  loadCurrentSession?: () => Promise<AuthSessionSnapshotDto>
  queryClient: QueryClient
  user: AuthSessionUserDto | null
}
