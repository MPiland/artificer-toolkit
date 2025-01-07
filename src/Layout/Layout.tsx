import AppShell from '../components/AppShell/AppShell'
import { useEffect, use } from 'react'
import Loading from '../components/Loading/Loading'
import { useListSystemsQuery } from '../features/systems/systemsApi'
import { LoadingContext } from '../components/Loading/LoadingContext'
import { AuthContext } from '../features/auth/AuthContext'
import NotSignedIn from './NotSignedIn'
import SignedIn from './SignedIn'
import LayoutProvider from './LayoutProvider'

const Layout = () => {
  const { user, isAuthenticating, isLoading: isUserLoading } = use(AuthContext)
  const { isLoading, setIsLoading } = use(LoadingContext)
  const { data: systems } = useListSystemsQuery()

  useEffect(() => {
    setIsLoading((prev) => prev && (isUserLoading || (!systems && !isUserLoading && user !== null)))
  }, [isUserLoading, systems, setIsLoading, user])

  return (
    <LayoutProvider>
      <AppShell>
        {!isAuthenticating && !user ? <NotSignedIn /> : <SignedIn />}
        {isLoading && <Loading />}
      </AppShell>
    </LayoutProvider>
  )
}

export default Layout
