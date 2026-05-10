import { getSupabaseServerClient } from '#supabase/server.server'
import { createServerFn } from '@tanstack/react-start'
import { getBlockedAuthRequest } from './requestSecurity'

export const resendCodeFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const blockedRequest = getBlockedAuthRequest()
    if (blockedRequest) {
      return blockedRequest
    }

    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.resend({
      email: data.email,
      type: 'signup'
    })
    return error ? { error: true } : { error: false }
  })
