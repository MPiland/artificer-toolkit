import {
  accountEmailUpdateInputSchema,
  accountPasswordUpdateInputSchema,
  type AccountDeleteInput,
  type AccountEmailUpdateInput,
  type AccountPasswordUpdateInput
} from '@artificer-toolkit/schema/api/account'
import { getSupabaseBrowserClient } from '#supabase/client'
import { deleteAccountFn } from '#app/server/auth/deleteAccountFn'

export type AccountActionResult = {
  ok: boolean
  message?: string
}

export const accountClient = {
  async updateEmail(input: AccountEmailUpdateInput): Promise<AccountActionResult> {
    const parsed = accountEmailUpdateInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'Enter a valid email address.'
      }
    }

    const { email } = parsed.data
    const emailRedirectTo = new URL(
      '/settings/account?emailChanged=1',
      window.location.origin
    ).toString()
    const { error } = await getSupabaseBrowserClient().auth.updateUser(
      { email },
      { emailRedirectTo }
    )
    return error ? { ok: false, message: error.message } : { ok: true }
  },

  async updatePassword(input: AccountPasswordUpdateInput): Promise<AccountActionResult> {
    const parsed = accountPasswordUpdateInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Enter valid passwords.' }
    }

    const client = getSupabaseBrowserClient()
    const { error: authenticationError } = await client.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.currentPassword
    })
    if (authenticationError) {
      return { ok: false, message: 'Your current password is incorrect.' }
    }

    const { error } = await client.auth.updateUser({
      password: parsed.data.password
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },

  async deleteAccount(input: AccountDeleteInput): Promise<AccountActionResult> {
    const result = await deleteAccountFn({ data: input })
    return 'error' in result ? { ok: false, message: result.message } : { ok: true }
  }
}
