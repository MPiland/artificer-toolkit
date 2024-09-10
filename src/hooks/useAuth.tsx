import { useEffect, useState } from 'react'
import { Hub } from 'aws-amplify/utils'
import { fetchAuthSession } from 'aws-amplify/auth'

export const useAuth = () => {
  const [user, setUser] = useState<any>(null)
  const [tokens, setTokens] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const session = await fetchAuthSession()
        if (session.tokens) {
          setUser(session.tokens.idToken) // Extract user data from ID token
          setTokens(session.tokens.accessToken)
        }
      } catch (error) {
        console.log('No current user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          fetchAuthSession().then((session) => {
            setUser(session.tokens?.idToken)
            setTokens(session.tokens?.accessToken)
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
  }
}
