import { createServerFn } from '@tanstack/react-start'
import { getApplicationFeatureFlags } from '@artificer-toolkit/apis/application-config'
import type { ApplicationFeatureFlagsDto } from '@artificer-toolkit/schema/api/applicationConfig'
import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '#supabase/server.server'

export interface AuthSessionSnapshot {
  featureFlags: ApplicationFeatureFlagsDto
  user: User | null
}

export const loadCurrentSessionFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthSessionSnapshot> => {
    const supabase = getSupabaseServerClient()
    const { data: userData } = await supabase.auth.getUser()

    return {
      featureFlags: getApplicationFeatureFlags(),
      user: userData.user ?? null
    }
  }
)
