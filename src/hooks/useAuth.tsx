import { jwtDecode } from 'jwt-decode'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from '../features/auth/authSlice'

interface AuthData {
  active: boolean
  id: string
}

const useAuth = (): AuthData => {
  const token: string | null = useSelector(selectCurrentToken)

  if (token) {
    const decoded: any = jwtDecode(token)
    const { active, id }: { active: boolean; id: string } = decoded.UserInfo
    return { active, id }
  }

  return { active: false, id: '' }
}

export default useAuth
