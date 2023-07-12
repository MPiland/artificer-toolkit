import { useLocation, Navigate, Outlet } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

const RequireAuth = () => {
  const location = useLocation()
  const { active } = useAuth()

  const content = active ? (
    <Outlet />
  ) : (
    <Navigate to='/' state={{ from: location }} replace />
  )

  return content
}
export default RequireAuth
