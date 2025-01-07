import AppShell from '../components/AppShell/AppShell'
import { use } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  header_title,
  header_item,
  header_item_group,
  sidebar_item_group,
  sidebar_item,
  sidebar_item_title,
} from './Layout.css'
import { useMediaQuery } from 'usehooks-ts'
import Button from '../components/Button/Button'
import IDarkMode from '../assets/Icons/IDarkMode'
import ILightMode from '../assets/Icons/ILightMode'
import ThemeContext from '../theme/ThemeContext'
import ILogo from '../assets/Icons/ILogo'
import { LayoutContext } from './LayoutContext'

const NotSignedIn = () => {
  const location = useLocation()
  const { themeType, toggleTheme } = use(ThemeContext)
  const { collapsed, setCollapsed } = use(LayoutContext)

  const sm = useMediaQuery('screen and (max-width: 567px)')
  const md = useMediaQuery('screen and (max-width: 1024px)')
  const lg = !sm && !md

  const noUserNavigation: { to: string; title: string }[] = [
    {
      to: '',
      title: 'Media',
    },
    {
      to: '',
      title: 'Pricing',
    },
    {
      to: '',
      title: 'About',
    },
    {
      to: 'register',
      title: 'Register',
    },
    {
      to: 'sign-in',
      title: 'Sign In',
    },
    {
      to: 'sign-up',
      title: 'Sign Up',
    },
  ]

  return (
    <>
      {!lg && (
        <AppShell.Header>
          <div className={header_item_group}>
            <AppShell.Hamburger onClick={() => setCollapsed((prev) => !prev)} collapsed={collapsed} />
            <div className={header_title}>
              <ILogo />
              Artificer Toolkit
            </div>
          </div>
        </AppShell.Header>
      )}
      <AppShell.Main>
        {lg && (
          <AppShell.Header>
            <div className={header_title}>
              <ILogo />
              Artificer Toolkit
            </div>
            <div className={header_item_group}>
              {noUserNavigation.map((noUser: { to: string; title: string }, index: number) => (
                <NavLink
                  className={header_item}
                  to={noUser.to}
                  key={index}
                  title={noUser.title}
                  state={{ background: location, title: noUser.title }}
                >
                  {noUser.title}
                </NavLink>
              ))}
              <Button style='unstyled' onClick={toggleTheme} className={header_item} width='size-7'>
                {themeType === 'light' ? <IDarkMode /> : <ILightMode />}
              </Button>
            </div>
          </AppShell.Header>
        )}
        {!lg && (
          <AppShell.Sidebar collapsed={collapsed}>
            <div className={sidebar_item_group}>
              {noUserNavigation.map((noUser: { to: string; title: string }, index: number) => (
                <NavLink className={sidebar_item} to={noUser.to} key={index}>
                  <span className={sidebar_item_title}>{noUser.title}</span>
                </NavLink>
              ))}
            </div>
          </AppShell.Sidebar>
        )}
        <AppShell.Content>
          <Outlet />
        </AppShell.Content>
      </AppShell.Main>
    </>
  )
}

export default NotSignedIn
