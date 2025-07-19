import { ReactNode, useEffect, useState } from 'react'
import { initUserDomainData, initUserFeatureData, signOut } from '@/apis/auth.api'
import { getCurrentUser, fetchAuthSession, AuthUser, AuthTokens } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { AuthContext } from './AuthContext'

const useAuthOptions = () => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tokens, setTokens] = useState<AuthTokens['accessToken'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [initData, setInitData] = useState<boolean>(false)

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
  }, [])

  useEffect(() => {
    const listener = Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          {
            if (initData === false) {
              setInitData(true)
              setIsAuthenticating(true)
              setIsLoading(true)
              try {
                const session = await fetchAuthSession()
                console.log('signed in')
                try {
                  const currentUser = await getCurrentUser()
                  setUser(currentUser)
                  if (session.tokens?.accessToken) {
                    setTokens(session.tokens?.accessToken)
                  }
                  setIsAuthenticating(false)
                  const email = session.tokens?.idToken?.payload?.email as string
                  const userId = session.tokens?.idToken?.payload?.sub
                  console.log({ session: session.tokens?.idToken?.payload })
                    if (email && userId) {
                      if (session.tokens?.idToken?.payload?.['custom:init_domain_data'] !== 'true') {
                        console.log('init user domain data')
                        try {
                          await initUserDomainData({ email, userId })
                          console.log('init user domain data complete')
                        } catch (err) {
                          console.log('Error initializing user domain data:', err)
                        }
                      }
                      if (session.tokens?.idToken?.payload?.['custom:init_feature_data'] !== 'true') {
                        console.log('init user feature data')
                        try {
                          await initUserFeatureData({ email, userId })
                          console.log('init user feature data complete')
                        } catch (err) {
                          console.log('Error initializing user feature data:', err)
                        }
                      }
                      setInitData(false)
                      setIsLoading(false)
                    }
                  setInitData(false)
                  setIsLoading(false)
                } catch (err) {
                  console.log('Error initializing user data:', err)
                }
                setInitData(false)
                setIsLoading(false)
              } catch (err) {
                console.log(err)
              }
              setInitData(false)
              setIsLoading(false)
            }
          }
          break
        case 'signedOut':
          setUser(null)
          setTokens(null)
          break
      }
    })

    return () => {
      listener()
    }
  }, [initData])

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
