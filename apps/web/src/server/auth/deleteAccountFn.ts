import { Novu } from '@novu/api'
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

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('notification_recipient_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError || !profile?.notification_recipient_id) {
      console.error('Account notification recipient lookup failed.')
      return {
        error: true,
        message: 'Could not delete your account. Try again.'
      }
    }

    const novuSecretKey = process.env.NOVU_SECRET_KEY
    if (!novuSecretKey) {
      console.error('Account notification cleanup is not configured.')
      return {
        error: true,
        message: 'Could not delete your account. Try again.'
      }
    }

    const novu = new Novu({ secretKey: novuSecretKey, retryConfig: { strategy: 'none' } })
    try {
      await novu.subscribers.delete(profile.notification_recipient_id)
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null
          ? 'statusCode' in error && typeof error.statusCode === 'number'
            ? error.statusCode
            : 'status' in error && typeof error.status === 'number'
              ? error.status
              : undefined
          : undefined
      if (status === 404) {
        // The recipient was already deleted by an earlier retry.
      } else {
        console.error('Account notification cleanup failed.', {
          status
        })
        return {
          error: true,
          message: 'Could not delete your account. Try again.'
        }
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
