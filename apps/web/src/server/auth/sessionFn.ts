import { createServerFn } from '@tanstack/react-start'
import { getApplicationFeatureFlags } from '@artificer-toolkit/apis/application-config'
import type { ApplicationFeatureFlagsDto } from '@artificer-toolkit/schema/api/applicationConfig'
import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '#supabase/server.server'

export interface AuthSessionSnapshot {
  featureFlags: ApplicationFeatureFlagsDto
  isSuperAdmin: boolean
  user: User | null
}

function hasSuperAdminClaim(claims: unknown, userId: string): boolean {
  if (typeof claims !== 'object' || claims === null) return false
  const subject = 'sub' in claims ? claims.sub : null
  const appMetadata = 'app_metadata' in claims ? claims.app_metadata : null
  return (
    subject === userId &&
    typeof appMetadata === 'object' &&
    appMetadata !== null &&
    'admin' in appMetadata &&
    (appMetadata.admin === true || appMetadata.admin === 'true')
  )
}

export const loadCurrentSessionFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthSessionSnapshot> => {
    const supabase = getSupabaseServerClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user ?? null

    return {
      featureFlags: getApplicationFeatureFlags(),
      isSuperAdmin: Boolean(user && hasSuperAdminClaim(claimsData?.claims, user.id)),
      user
    }
  }
)
