import { ReactNode, useEffect, useState } from 'react'
import { getUserCommand, refreshTokens, signOut } from '@/apis/authApi'
import { Hub } from 'aws-amplify/utils'
import { AuthContext } from './AuthContext'

const useAuthOptions = () => {
  const [user, setUser] = useState<any | null>(null)
  const [tokens, setTokens] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      try {
        // Check for token in session storage
        const accessToken = sessionStorage.getItem('artificerToolkitToken')

        if (accessToken) {
          // Get user data using the token
          const userResponse = await getUserCommand()

          if (userResponse && userResponse.UserAttributes) {
            const userAttributes: Record<string, string> = {}

            // Safely convert attributes to a record
            userResponse.UserAttributes.forEach((attr) => {
              if (attr.Name && attr.Value) {
                userAttributes[attr.Name] = attr.Value
              }
            })

            setUser({
              username: userResponse.Username || '',
              attributes: userAttributes,
            })
            setTokens(accessToken)
          } else {
            // Token exists but couldn't get user - token might be invalid
            await signOut()
            setUser(null)
            setTokens(null)
          }
        } else {
          // Check for refresh token
          const refreshToken = localStorage.getItem('artificerToolkitRefresh')

          if (refreshToken) {
            try {
              // Try to refresh the session
              const refreshResponse = await refreshTokens(refreshToken)

              if (refreshResponse && refreshResponse.user) {
                const userAttributes: Record<string, string> = {}

                // Safely convert attributes to a record
                refreshResponse.user.forEach((attr) => {
                  if (attr.Name && attr.Value) {
                    userAttributes[attr.Name] = attr.Value
                  }
                })

                setUser({
                  username: refreshResponse.user.find((attr) => attr.Name === 'email')?.Value || '',
                  attributes: userAttributes,
                })

                // Handle potential undefined tokens safely
                if (refreshResponse.tokens.AccessToken) {
                  setTokens(refreshResponse.tokens.AccessToken)
                }
              } else {
                await signOut()
                setUser(null)
                setTokens(null)
              }
            } catch (error) {
              console.error('Error refreshing tokens:', error)
              await signOut()
              setUser(null)
              setTokens(null)
            }
          } else {
            // No tokens found
            setUser(null)
            setTokens(null)
          }
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setUser(null)
        setTokens(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    // Listen for auth events
    const hubListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          setIsAuthenticating(true)
          // After sign in, get the user data
          getUserCommand()
            .then((userResponse) => {
              if (userResponse && userResponse.UserAttributes) {
                const userAttributes: Record<string, string> = {}

                // Safely convert attributes to a record
                userResponse.UserAttributes.forEach((attr) => {
                  if (attr.Name && attr.Value) {
                    userAttributes[attr.Name] = attr.Value
                  }
                })

                setUser({
                  username: userResponse.Username || '',
                  attributes: userAttributes,
                })

                const token = sessionStorage.getItem('artificerToolkitToken')
                if (token) {
                  setTokens(token)
                }
              }
              setIsAuthenticating(false)
            })
            .catch((error) => {
              console.error('Error getting user after sign in:', error)
              setIsAuthenticating(false)
            })
          break
        case 'signedOut':
          setUser(null)
          setTokens(null)
          break
      }
    })

    // Clean up listener on unmount
    return () => {
      hubListener()
    }
  }, [])

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

export type AuthOptionsType = ReturnType<typeof useAuthOptions>
