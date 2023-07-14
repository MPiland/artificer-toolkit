import jwtDecode from 'jwt-decode'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from '../features/auth/authSlice'

const useAuth = () => {
  const token = useSelector(selectCurrentToken)

  if (token) {
    const decoded = jwtDecode(token)
    const { active, id } = decoded.UserInfo
    return { active, id }
  }

  return { active: false, id: '' }
}

export default useAuth
