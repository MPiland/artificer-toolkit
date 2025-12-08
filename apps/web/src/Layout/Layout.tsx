import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { AppShell, Modal, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { Outlet } from '@tanstack/react-router'
import { use, Suspense, useEffect } from 'react'
import { AuthContext } from '../auth/AuthContext'
import * as layout from './Layout.css'
import * as navbar from './Navbar/Navbar.css'
import Loading from '~components/Loading'
import clsx from 'clsx'
import { ModalContext } from '~components/Modal'
import AuthNavbar from './Navbar/AuthNavbar'
import UnAuthNavbar from './Navbar/UnAuthNavbar'
import Header from './Header/Header'

const Layout = () => {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true)
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const { showModal, hideModal } = use(ModalContext)
  const { user: authUser, isAuthenticating, isLoading } = use(AuthContext)
  const signedIn = !isAuthenticating && authUser != null

  const lg = useMediaQuery('(min-width: 993px)')

  useEffect(() => {
    if (isLoading) {
      showModal({
        type: 'loading',
      })
    }
    if (!isLoading) {
      hideModal()
    }
  }, [hideModal, showModal, isLoading])

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')
  }

  useEffect(() => {
    if (mobileOpened && lg) {
      toggleMobile()
    }
    if (desktopOpened && (!lg || !signedIn)) {
      toggleDesktop()
    }
  }, [lg, mobileOpened, desktopOpened, toggleDesktop, toggleMobile, signedIn])

  return (
    <AppShell
      layout={!lg ? 'alt' : 'default'}
      header={{ height: 60 }}
      navbar={{
        width: '16rem',
        breakpoint: 'xs',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding='md'
      id='app-shell'
      className={clsx(layout.base, { ['unAuth']: !signedIn }, { ['collapsed']: !desktopOpened && !mobileOpened })}
    >
      <Header
        toggleMobile={toggleMobile}
        mobileOpened={mobileOpened}
        toggleDesktop={toggleDesktop}
        desktopOpened={desktopOpened}
        toggleColorScheme={toggleColorScheme}
        lg={lg ?? false}
        signedIn={signedIn}
      />
      <AppShell.Navbar className={navbar.base}>
        {signedIn ?
          <AuthNavbar
            toggleMobile={toggleMobile}
            mobileOpened={mobileOpened}
            desktopOpened={desktopOpened}
            authUser={authUser}
            toggleColorScheme={toggleColorScheme}
            lg={lg ?? false}
          />
        : <UnAuthNavbar toggleMobile={toggleMobile} mobileOpened={mobileOpened} />}
      </AppShell.Navbar>
      <AppShell.Main className={layout.main}>
        <Suspense
          fallback={
            <Modal opened onClose={() => {}} centered size='auto' withCloseButton={false}>
              <Loading />
            </Modal>
          }
        >
          <></>
          <Outlet />
        </Suspense>
      </AppShell.Main>
    </AppShell>
  )
}

export default Layout
