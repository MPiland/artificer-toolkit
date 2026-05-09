import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { getBlockedAuthRequest } from './requestSecurity'
import { getSupabaseServerClient } from '#supabase/server.server'

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const blockedRequest = getBlockedAuthRequest()
  if (blockedRequest) {
    return blockedRequest
  }

  const supabase = getSupabaseServerClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return {
      error: true,
      message: error.message
    }
  }

  throw redirect({
    href: '/'
  })
})
