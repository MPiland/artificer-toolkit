import { getSupabaseBrowserClient } from '../supabase/client'

export interface AuthResult {
  ok: boolean
  message?: string
}

export interface SignInInput {
  email: string
  password: string
}

export interface SignUpInput extends SignInInput {
  name: string
}

export interface RequestPasswordResetInput {
  email: string
}

export interface UpdatePasswordInput {
  password: string
}

export interface AuthClient {
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
  async signIn(input) {
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword(input)
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async signUp(input) {
    const { error } = await getSupabaseBrowserClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.name
        },
        emailRedirectTo: getAuthRedirectUrl('/auth/confirmed')
      }
    })
    return error ? { ok: false, message: error.message } : { ok: true }
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
