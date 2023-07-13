import jwtDecode from 'jwt-decode'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from '../features/auth/authSlice'
import { useEffect } from 'react'

const useAuth = () => {
  const token = useSelector(selectCurrentToken)

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token)
      const { active, id } = decoded.UserInfo
      return { active, id }
    }
  })

  return { active: false, id: '' }
}

export default useAuth
