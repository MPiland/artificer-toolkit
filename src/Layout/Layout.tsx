import AppShell from '../components/AppShell/AppShell'
import { useEffect, use, Suspense } from 'react'
import Loading from '../components/Loading/Loading'
import { LoadingContext } from '../components/Loading/LoadingContext'
import { AuthContext } from '../features/auth/AuthContext'
import NotSignedIn from './NotSignedIn'
import SignedIn from './SignedIn'
import LayoutProvider from './LayoutProvider'

const Layout = () => {
  const { user, isAuthenticating, isLoading: isUserLoading } = use(AuthContext)
  const { isLoading, setIsLoading } = use(LoadingContext)

  useEffect(() => {
    setIsLoading((prev) => prev && (isUserLoading || isAuthenticating))
  }, [isUserLoading, isAuthenticating, setIsLoading])

  return (
    <LayoutProvider>
      <Suspense fallback={<Loading />}>
        <AppShell>
          {!isAuthenticating && !user ? <NotSignedIn /> : <SignedIn />}
          {isLoading && <Loading />}
        </AppShell>
      </Suspense>
    </LayoutProvider>
  )
}

export default Layout
