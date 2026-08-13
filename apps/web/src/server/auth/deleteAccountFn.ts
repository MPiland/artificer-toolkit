import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { accountDeleteInputSchema } from '@artificer-toolkit/schema/api/account'
import { getSupabaseAdminClient } from '#supabase/admin.server'
import { getSupabaseServerClient } from '#supabase/server.server'
import { getBlockedAuthRequest } from './requestSecurity'

export const deleteAccountFn = createServerFn({ method: 'POST' })
  .inputValidator(accountDeleteInputSchema)
  .handler(async ({ data }) => {
    const blockedRequest = getBlockedAuthRequest()
    if (blockedRequest) {
      return blockedRequest
    }

    const sessionClient = getSupabaseServerClient()
    const { data: userData, error: userError } = await sessionClient.auth.getUser()
    const user = userData.user

    if (userError || !user?.email) {
      return {
        error: true,
        message: 'Your session has expired. Sign in and try again.'
      }
    }

    if (user.email.toLowerCase() !== data.email.toLowerCase()) {
      return {
        error: true,
        message: 'Enter the email address for this account.'
      }
    }

    const verificationClient = createClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    const { error: verificationError } = await verificationClient.auth.signInWithPassword({
      email: user.email,
      password: data.currentPassword
    })

    if (verificationError) {
      return {
        error: true,
        message: 'The current password is incorrect.'
      }
    }

    const adminClient = getSupabaseAdminClient()
    const { data: ownedCampaign, error: ownedCampaignError } = await adminClient
      .from('campaigns')
      .select('id')
      .eq('owner_user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (ownedCampaignError) {
      console.error('Account deletion eligibility lookup failed.')
      return {
        error: true,
        message: 'Could not delete your account. Try again.'
      }
    }
    if (ownedCampaign) {
      return {
        error: true,
        message: 'Transfer or delete your Campaigns before deleting your account.'
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('Account deletion failed.', deleteError)
      return {
        error: true,
        message: 'Could not delete your account. Try again.'
      }
    }

    return { ok: true as const }
  })
