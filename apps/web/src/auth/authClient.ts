import { getSupabaseBrowserClient } from '../supabase/client'
import { signUpFn } from '../server/auth/signUpFn'
import { api } from '../lib/api'
import {
  authInvitationCompletionInputSchema,
  authPasswordUpdateInputSchema,
  authPasswordRecoveryVerificationInputSchema,
  authSignInInputSchema,
  type AuthInvitationCompletionInput,
  type AuthPasswordRecoveryVerificationInput,
  type AuthPasswordUpdateInput,
  type AuthSignInInput,
  type AuthSignUpInput
} from '@artificer-toolkit/schema/api/auth'
import type { Session } from '@supabase/supabase-js'

export interface AuthResult {
  ok: boolean
  message?: string
  session?: Session | null
}

export type SignInInput = AuthSignInInput

export type SignUpInput = AuthSignUpInput

export interface RequestPasswordResetInput {
  email: string
}

export type UpdatePasswordInput = AuthPasswordUpdateInput

export type VerifyPasswordRecoveryInput = AuthPasswordRecoveryVerificationInput

export type CompleteInvitationInput = AuthInvitationCompletionInput

export interface AuthClient {
  completeInvitation(input: CompleteInvitationInput): Promise<AuthResult>
  signIn(input: SignInInput): Promise<AuthResult>
  signUp(input: SignUpInput): Promise<AuthResult>
  requestPasswordReset(input: RequestPasswordResetInput): Promise<AuthResult>
  verifyPasswordRecovery(input: VerifyPasswordRecoveryInput): Promise<AuthResult>
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
      await api.account.completeInvitation(parsed.data)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not complete registration.'
      }
    }
  },
  async signIn(input) {
    const parsed = authSignInInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: 'Check your email or username and password, then try again.' }
    }

    const client = getSupabaseBrowserClient()
    if (parsed.data.identifier.includes('@')) {
      const { data, error } = await client.auth.signInWithPassword({
        email: parsed.data.identifier,
        password: parsed.data.password
      })
      return error
        ? { ok: false, message: 'Check your email or username and password, then try again.' }
        : { ok: true, session: data.session ?? null }
    }

    try {
      const credentials = await api.account.signInWithUsername({
        username: parsed.data.identifier,
        password: parsed.data.password
      })
      const { data, error } = await client.auth.setSession({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken
      })
      return error
        ? { ok: false, message: 'Check your email or username and password, then try again.' }
        : { ok: true, session: data.session ?? null }
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 429
      ) {
        return { ok: false, message: 'Too many sign-in attempts. Try again shortly.' }
      }
      return { ok: false, message: 'Check your email or username and password, then try again.' }
    }
  },
  async signUp(input) {
    return signUpFn({ data: input })
  },
  async requestPasswordReset(input) {
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(input.email, {
      redirectTo: getAuthRedirectUrl('/update-password')
    })
    return error
      ? { ok: false, message: "We couldn't send a verification code. Try again." }
      : { ok: true }
  },
  async verifyPasswordRecovery(input) {
    const parsed = authPasswordRecoveryVerificationInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message }
    }

    const { data, error } = await getSupabaseBrowserClient().auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: 'recovery'
    })
    return error
      ? { ok: false, message: 'That verification code is invalid or has expired.' }
      : { ok: true, session: data.session ?? null }
  },
  async updatePassword(input) {
    const parsed = authPasswordUpdateInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message }
    }

    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: parsed.data.password
    })
    return error
      ? { ok: false, message: "We couldn't update your password. Try again." }
      : { ok: true }
  },
  async signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    return error ? { ok: false, message: error.message } : { ok: true }
  }
}
