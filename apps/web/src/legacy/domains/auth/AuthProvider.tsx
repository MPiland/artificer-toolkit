import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { getSupabaseBrowserClient } from '@utils'
import { mapAuthError } from './mapAuthError'

export interface SupabaseAuthError {
  message: string
  code?: string
}

function useAuthOptions() {
  const supabase = getSupabaseBrowserClient()

  const [
    session,
    setSession
  ] = useState<Session | null>(null)
  const [
    user,
    setUser
  ] = useState<User | null>(null)
  const [
    isAuthenticating,
    setIsAuthenticating
  ] = useState(true)
  const [
    isLoading,
    setIsLoading
  ] = useState(false)
  const [
    authEvent,
    setAuthEvent
  ] = useState<AuthChangeEvent | null>(null)

  // 1) Initial load
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then((res) => {
      if (!mounted) return
      const { data } = res
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      setIsAuthenticating(false)
    })

    return () => {
      mounted = false
    }
  }, [
    supabase.auth
  ])

  // 2) Subscribe to onAuthStateChange
  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setAuthEvent(event)
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [
    supabase.auth
  ])

  // 3) Auth API actions
  const value: AuthContextValue = useMemo(
    () => ({
      user,
      session,
      authEvent,
      isAuthenticating,
      isLoading,

      signInWithPassword: async (email, password) => {
        setIsLoading(true)
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          return {
            error: error ? mapAuthError(error) : undefined
          }
        } finally {
          setIsLoading(false)
        }
      },

      signUp: async (email, password) => {
        setIsLoading(true)
        try {
          const { data, error } = await supabase.auth.signUp({ email, password })
          return { data, error: error ? mapAuthError(error) : undefined }
        } finally {
          setIsLoading(false)
        }
      },

      signOut: async () => {
        setIsLoading(true)
        try {
          await supabase.auth.signOut()
        } finally {
          setIsLoading(false)
        }
      }
    }),
    [
      user, session, isAuthenticating, isLoading, authEvent, supabase.auth
    ]
  )

  return value
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthOptions()

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export type AuthOptions = ReturnType<typeof useAuthOptions>
