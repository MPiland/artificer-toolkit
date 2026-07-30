import { getSupabaseBrowserClient } from '../supabase/client'
import { signUpFn } from '../server/auth/signUpFn'
import { api } from '../lib/api'
import type { AuthSignUpInput } from '@artificer-toolkit/schema/api/auth'
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

export interface UpdatePasswordInput {
  password: string
}

export interface CompleteInvitationInput extends UpdatePasswordInput {
  username: string
}

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
    try {
      const existingProfile = await api.account.profile()
      const usernameStatus = await api.account.usernameStatus({ username: input.username })
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
        password: input.password
      })
      if (error) return { ok: false, message: error.message }

      await api.account.updateProfile({
        username: input.username,
        name: existingProfile?.name ?? null,
        bio: existingProfile?.bio ?? null
      })
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
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: input.password
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    return error ? { ok: false, message: error.message } : { ok: true }
  }
}
