import { ReactNode, useEffect, useState } from 'react'
import { verifyUser } from '~/apis'
import { AuthContext } from './AuthContext'

const useAuthOptions = () => {
  const [user, setUser] = useState<unknown | null>(null)
  const [tokens, setTokens] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { user, tokens } = await verifyUser()
      setUser(user)
      setTokens(tokens)
      setIsLoading(false)
    }

    checkUser()
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
