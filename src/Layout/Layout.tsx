import { use, Suspense } from 'react'
import Loading from '../components/Loading/Loading'
import { AuthContext } from '../features/auth/AuthContext'
import LayoutProvider from './LayoutProvider'
import Header from './Header'
import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { content, layout } from './Layout.css'
import ThemeContext from '../theme/ThemeContext'

const Layout = () => {
  const { user, isAuthenticating } = use(AuthContext)
  const signedIn = !isAuthenticating && user != null
  const { themeVar } = use(ThemeContext)

  console.log({ isAuthenticating, user })

  return (
    <LayoutProvider>
      <div className={clsx(layout, themeVar)} id='app-main'>
        <Header signedIn={signedIn} />
        <Suspense fallback={<Loading />}>
          <Sidebar signedIn={signedIn} />
          <div className={content}>
            <Outlet />
          </div>
        </Suspense>
      </div>
    </LayoutProvider>
  )
}

export default Layout
