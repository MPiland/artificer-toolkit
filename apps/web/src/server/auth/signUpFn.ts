import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { getApplicationFeatureFlags } from '@artificer-toolkit/apis/application-config'
import { authSignUpInputSchema } from '@artificer-toolkit/schema/api/auth'
import { validateUsername } from '@artificer-toolkit/shared/account/username'
import { getSupabaseServerClient } from '#supabase/server.server'
import { getBlockedAuthRequest } from './requestSecurity'

export const signUpFn = createServerFn({ method: 'POST' })
  .inputValidator(authSignUpInputSchema)
  .handler(async ({ data }) => {
    const blockedRequest = getBlockedAuthRequest()
    if (blockedRequest) {
      return { ok: false, message: blockedRequest.message, session: null }
    }

    if (!getApplicationFeatureFlags().publicSignUpEnabled) {
      return {
        ok: false,
        message: 'Public sign-up is currently disabled.',
        session: null
      }
    }

    const username = validateUsername(data.username)
    if (username.message) {
      return { ok: false, message: username.message, session: null }
    }

    const supabase = getSupabaseServerClient()
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          username: username.username
        },
        emailRedirectTo: new URL('/auth/confirmed', getRequestUrl()).toString()
      }
    })

    return error
      ? { ok: false, message: error.message, session: null }
      : { ok: true, session: signUpData.session }
  })
