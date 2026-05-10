import { getSupabaseServerClient } from '#supabase/server.server'
import { createServerFn } from '@tanstack/react-start'
import { getBlockedAuthRequest } from './requestSecurity'

export const resetPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const blockedRequest = getBlockedAuthRequest()
    if (blockedRequest) {
      return blockedRequest
    }

    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) return { error: true }
    return { error: false }
  })
