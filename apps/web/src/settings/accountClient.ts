import {
  accountEmailUpdateInputSchema,
  accountDeleteInputSchema,
  accountPasswordUpdateInputSchema,
  type AccountDeleteInput,
  type AccountEmailUpdateInput,
  type AccountPasswordUpdateInput
} from '@artificer-toolkit/schema/api/account'
import { betterAuthClient } from '#app/auth/betterAuthClient'

type AccountActionResult = {
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

    try {
      const result = await betterAuthClient.$fetch('/change-email', {
        method: 'POST',
        body: {
          newEmail: parsed.data.email,
          callbackURL: new URL(
            '/settings/account?emailChanged=1',
            window.location.origin
          ).toString()
        }
      })
      return result.error
        ? {
            ok: false,
            message: result.error.message ?? 'Could not update your email. Try again.'
          }
        : { ok: true }
    } catch {
      return { ok: false, message: 'Could not update your email. Try again.' }
    }
  },

  async updatePassword(input: AccountPasswordUpdateInput): Promise<AccountActionResult> {
    const parsed = accountPasswordUpdateInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Enter valid passwords.' }
    }

    try {
      const result = await betterAuthClient.$fetch('/account/password', {
        method: 'POST',
        body: parsed.data
      })
      if (!result.error) return { ok: true }
      if (result.error.code === 'INVALID_PASSWORD') {
        return { ok: false, message: 'Your current password is incorrect.' }
      }
      return {
        ok: false,
        message: result.error.message ?? 'Could not update your password. Try again.'
      }
    } catch {
      return { ok: false, message: 'Could not update your password. Try again.' }
    }
  },

  async deleteAccount(input: AccountDeleteInput): Promise<AccountActionResult> {
    const parsed = accountDeleteInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        message:
          parsed.error.issues[0]?.message ?? 'Enter a valid email address and current password.'
      }
    }

    try {
      const result = await betterAuthClient.$fetch('/account/delete', {
        method: 'POST',
        body: parsed.data
      })
      return result.error
        ? {
            ok: false,
            message: result.error.message ?? 'Could not delete your account. Try again.'
          }
        : { ok: true }
    } catch {
      return { ok: false, message: 'Could not delete your account. Try again.' }
    }
  }
}
