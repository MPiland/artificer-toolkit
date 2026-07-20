import { createServerFn } from '@tanstack/react-start'
import { authInviteConfirmationInputSchema } from '@artificer-toolkit/schema/api/auth'
import { getSupabaseServerClient } from '#supabase/server.server'

export const confirmInviteFn = createServerFn({ method: 'POST' })
  .inputValidator(authInviteConfirmationInputSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: 'invite'
    })

    return error
      ? { ok: false, message: 'This invitation link is invalid or has expired.' }
      : { ok: true }
  })
