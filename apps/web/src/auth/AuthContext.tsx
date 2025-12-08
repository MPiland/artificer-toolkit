import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { NormalizedAuthError } from './mapAuthError'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  authEvent: string | null
  isAuthenticating: boolean
  isLoading: boolean

  signInWithPassword: (email: string, password: string) => Promise<{ error?: NormalizedAuthError }>

  signUp: (
    email: string,
    password: string
  ) => Promise<{
    data?: { session: Session | null }
    error?: NormalizedAuthError
  }>

  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
