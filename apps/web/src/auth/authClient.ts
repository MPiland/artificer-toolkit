import { getSupabaseBrowserClient } from '../supabase/client'
import { signUpFn } from '../server/auth/signUpFn'
import { api } from '../lib/api'
import {
  authInvitationCompletionInputSchema,
  authPasswordUpdateInputSchema,
  type AuthInvitationCompletionInput,
  type AuthPasswordUpdateInput,
  type AuthSignUpInput
} from '@artificer-toolkit/schema/api/auth'
import type { Session } from '@supabase/supabase-js'

export interface AuthResult {
  ok: boolean
  message?: string
  session?: Session | null
}

export interface SignInInput {
  email: string
  password: string
}

export type SignUpInput = AuthSignUpInput

export interface RequestPasswordResetInput {
  email: string
}

export type UpdatePasswordInput = AuthPasswordUpdateInput

export type CompleteInvitationInput = AuthInvitationCompletionInput

export interface AuthClient {
  completeInvitation(input: CompleteInvitationInput): Promise<AuthResult>
  signIn(input: SignInInput): Promise<AuthResult>
  signUp(input: SignUpInput): Promise<AuthResult>
  requestPasswordReset(input: RequestPasswordResetInput): Promise<AuthResult>
  updatePassword(input: UpdatePasswordInput): Promise<AuthResult>
  signOut(): Promise<AuthResult>
}

function getAuthRedirectUrl(path: string) {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}${path}`
}

export const browserAuthClient: AuthClient = {
  async completeInvitation(input) {
    const parsed = authInvitationCompletionInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message }
    }

    try {
      const usernameStatus = await api.account.usernameStatus({ username: parsed.data.username })
      if (usernameStatus.status !== 'available') {
        return {
          ok: false,
          message:
            usernameStatus.status === 'taken'
              ? 'That username is already taken.'
              : "That username isn't allowed."
        }
      }

      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        password: parsed.data.password,
        data: { username: parsed.data.username }
      })
      if (error?.code === 'same_password') {
        const { error: profileError } = await getSupabaseBrowserClient().auth.updateUser({
          data: { username: parsed.data.username }
        })
        return profileError ? { ok: false, message: profileError.message } : { ok: true }
      }
      if (error) {
        return { ok: false, message: error.message }
      }

      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not complete registration.'
      }
    }
  },
  async signIn(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword(input)
    return error
      ? { ok: false, message: error.message }
      : { ok: true, session: data.session ?? null }
  },
  async signUp(input) {
    return signUpFn({ data: input })
  },
  async requestPasswordReset(input) {
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(input.email, {
      redirectTo: getAuthRedirectUrl('/update-password')
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async updatePassword(input) {
    const parsed = authPasswordUpdateInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message }
    }

    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: parsed.data.password
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    return error ? { ok: false, message: error.message } : { ok: true }
  }
}
