import { ReactNode, useEffect, useState } from 'react'
import { useSignOut } from './authApi'
import { getCurrentUser, fetchAuthSession, AuthUser, AuthTokens } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { AuthContext } from './AuthContext'

const useAuthOptions = () => {
  const [user, setUser] = useState<AuthUser>(null)
  const [tokens, setTokens] = useState<AuthTokens['accessToken']>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const { mutateAsync: signOut } = useSignOut()

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
        setIsLoading(false)
      } catch (error) {
        console.log('No current user:', error)
        setUser(null)
        setTokens(null)
      }
    }

    checkUser()

    Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          setIsAuthenticating(true)
          fetchAuthSession().then(async (session) => {
            const currentUser = await getCurrentUser()
            setUser(currentUser)
            setTokens(session.tokens?.accessToken)
            setIsAuthenticating(false)
          })
          break
        case 'signedOut':
          setUser(null)
          setTokens(null)
          break
      }
    })
  }, [signOut])

  return {
    user,
    tokens,
    isLoading,
    isAuthenticating,
  }
}

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const authOptions = useAuthOptions()
  return <AuthContext value={authOptions}>{children}</AuthContext>
}

export default AuthProvider

export type AuthOptionsType = ReturnType<typeof useAuthOptions> | null
