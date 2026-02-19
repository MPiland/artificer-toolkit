import type { AuthError } from '@supabase/supabase-js'

export interface NormalizedAuthError {
  message: string
  code: string
}

// Known auth error codes Supabase may return.
// This list is safe to expand as needed.
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_not_found'
  | 'user_already_registered'
  | 'email_address_already_registered'
  | 'user_already_exists'
  | 'weak_password'
  | 'unexpected_failure'
  | string // fallback for unknown error codes

export function mapAuthError(error: AuthError): NormalizedAuthError {
  // Supabase errors may have `error.code` OR only a generic message.
  const code = (error as any).code as AuthErrorCode | undefined

  return {
    code: code ?? 'unexpected_failure',
    message: error.message,
  }
}
