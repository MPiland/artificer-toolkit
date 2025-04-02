import { use, Suspense } from 'react'
import Loading from '../components/Loading/Loading'
import { AuthContext } from '../pages/auth/AuthContext'
import LayoutProvider from './LayoutProvider'
import Header from './Header'
import Sidebar from './Sidebar'
import { Outlet } from '@tanstack/react-router'
import clsx from 'clsx'
import { content, layout } from './Layout.css'
import ThemeContext from '../theme/ThemeContext'
import ModalProvider from '../components/Modal/ModalProvider'
import { ToOptions, NavigateOptions } from '@tanstack/react-router'

export const noUserNavigation: { to: ToOptions['to']; params?: NavigateOptions['params']; title: string }[] = [
  {
    to: '/',
    title: 'Media',
  },
  {
    to: '/',
    title: 'Pricing',
  },
  {
    to: '/',
    title: 'About',
  },
  {
    to: '/$auth',
    params: {
      auth: 'sign-in',
    },
    title: 'Sign In',
  },
  {
    to: '/$auth',
    params: {
      auth: 'sign-up',
    },
    title: 'Sign Up',
  },
]

const Layout = () => {
  const { user, isAuthenticating } = use(AuthContext)
  const signedIn = !isAuthenticating && user != null

  const { themeVar } = use(ThemeContext)
  
  return (
    <LayoutProvider>
      <div className={clsx(layout, themeVar)} id='app-main'>
        <ModalProvider>
          <Header signedIn={signedIn} />
          <Suspense fallback={<Loading />}>
            <Sidebar signedIn={signedIn} />
            <div className={content}>
              <Outlet />
            </div>
          </Suspense>
        </ModalProvider>
      </div>
    </LayoutProvider>
  )
}

export default Layout
