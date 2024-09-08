import { useEffect, useState } from 'react'

const useAuth = (): [string, React.Dispatch<React.SetStateAction<string>>] => {
  const tokenStorage = sessionStorage.getItem('accessToken') ?? ''
  const [token, setToken] = useState<string>(tokenStorage ?? '')

  useEffect(() => {
    setToken(tokenStorage)
  }, [tokenStorage])

  return [token, setToken]
}

export default useAuth
