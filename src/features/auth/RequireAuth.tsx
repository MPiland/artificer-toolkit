import { Navigate, Outlet } from 'react-router-dom'
import { use } from 'react'
import AuthContext from './AuthContext'

const RequireAuth = () => {
  const { user, isAuthenticating, isLoading: isUserLoading } = use(AuthContext)

  if (!isAuthenticating && !user && !isUserLoading) {
    return <Navigate to='/' />
  } else {
    return <Outlet />
  }
}

export default RequireAuth
