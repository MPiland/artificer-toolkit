import type { QueryClient } from '@tanstack/react-query'
import type { ApplicationFeatureFlagsDto } from '@artificer-toolkit/schema/api/applicationConfig'
import type { AuthSessionSnapshotDto, AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'

export interface AppRouterContext {
  featureFlags?: ApplicationFeatureFlagsDto
  isSuperAdmin?: boolean
  nonce?: string
  loadCurrentSession?: () => Promise<AuthSessionSnapshotDto>
  /** Server only: the token minted for this request, which seeds the browser's provider. */
  loadInitialToken?: () => Promise<string | null>
  queryClient: QueryClient
  user: AuthSessionUserDto | null
}
