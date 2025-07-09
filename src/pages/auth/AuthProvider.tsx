import { ReactNode, useEffect, useState } from 'react'
import { initUserData, signOut } from '@/apis/auth.api'
import { getCurrentUser, fetchAuthSession, AuthUser, AuthTokens } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { AuthContext } from './AuthContext'

const useAuthOptions = () => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tokens, setTokens] = useState<AuthTokens['accessToken'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          const session = await fetchAuthSession()
          if (session && session.tokens) {
            setUser(currentUser)
            setTokens(session.tokens.accessToken)
          }
        } else {
          await signOut()
          setUser(null)
          setTokens(null)
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.log('No current user:', error)
        }
        setUser(null)
        setTokens(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          setIsAuthenticating(true)
          setIsLoading(true)
          fetchAuthSession().then(async (session) => {
            const currentUser = await getCurrentUser()
            setUser(currentUser)
            if (session.tokens?.accessToken) {
              setTokens(session.tokens?.accessToken)
            }
            setIsAuthenticating(false)
            if (session.tokens?.idToken?.payload?.['init-data-complete'] !== 'true') {
              console.log('init user data')
              const email = session.tokens?.idToken?.payload?.email as string
              const userId = session.tokens?.idToken?.payload?.sub
              if (email && userId) {
                try {
                  await initUserData({ email, userId })
                  console.log('init user data complete')
                } catch (err) {
                  if (import.meta.env.DEV) {
                    console.log('Error initializing user data:', err)
                  }
                }
              }
            }
            setIsLoading(false)
          })
          break
        case 'signedOut':
          setUser(null)
          setTokens(null)
          break
      }
    })
  }, [])

  return {
    user,
    tokens,
    isLoading,
    isAuthenticating,
    setIsAuthenticating,
  }
}

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const authOptions = useAuthOptions()
  return <AuthContext value={authOptions}>{children}</AuthContext>
}

export default AuthProvider

export type AuthOptionsType = ReturnType<typeof useAuthOptions>
