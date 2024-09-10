import AppShell from '../components/AppShell/AppShell'
import { ReactNode, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  header_title,
  header_item,
  header_item_group,
  sidebar_item_group,
  sidebar_item,
  sidebar_icon,
  sidebar_item_title,
  sidebar_header,
} from './Layout.css'
import { useMediaQuery } from 'usehooks-ts'
import CharactersIcon from '../assets/Icons/IChar'
import ClassesIcon from '../assets/Icons/IClass'
import RacesIcon from '../assets/Icons/IRaces'
import { useTheme } from '../hooks/useTheme'
import Button from '../components/Button/Button'
import ScrollIcon from '../assets/Icons/IScroll'
import SackIcon from '../assets/Icons/ISack'
import { useAuth } from '../hooks/useAuth'
import { sprinkles } from '../css/sprinkles.css'
import clsx from 'clsx'
import { useSignOut } from '../features/auth/authApi'
import IDarkMode from '../assets/Icons/IDarkMode'
import ILightMode from '../assets/Icons/ILightMode'
import IUser from '../assets/Icons/IUser'
import Spinner from '../components/Spinner/Spinner'

const Layout = () => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  const { themeType, toggleTheme } = useTheme()

  const sm = useMediaQuery('screen and (max-width: 567px)')

  const { mutateAsync: signOut } = useSignOut()

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
      to: 'signin',
      title: 'Sign In',
    },
    {
      to: 'signup',
      title: 'Sign Up',
    },
  ]

  const userNavigation: { icon?: ReactNode; to: string; title: string }[] = [
    { icon: <CharactersIcon />, to: 'characters', title: 'Characters' },
    {
      icon: <ClassesIcon />,
      to: 'classes',
      title: 'Classes',
    },
    {
      icon: <RacesIcon />,
      to: 'races',
      title: 'Races',
    },
    {
      icon: <ScrollIcon />,
      to: 'spells',
      title: 'Spells',
    },
    {
      icon: <SackIcon />,
      to: 'items',
      title: 'Items',
    },
    {
      icon: <CharactersIcon />,
      to: 'backgrounds',
      title: 'Backgrounds',
    },
    {
      icon: <CharactersIcon />,
      to: 'feats',
      title: 'Feats',
    },
  ]

  return isLoading ? (
    <Spinner />
  ) : (
    <AppShell>
      {(!user && sm) ||
        (user && (
          <AppShell.Sidebar collapsed={sidebarCollapsed}>
            <div className={sidebar_header}>
              <AppShell.Hamburger onClick={() => setSidebarCollapsed((prev) => !prev)} collapsed={sidebarCollapsed} />
            </div>
            <div className={sidebar_item_group}>
              {!user &&
                sm &&
                noUserNavigation.map((noUser: { to: string; title: string }, index: number) => (
                  <NavLink className={sidebar_item} to={noUser.to} key={index}>
                    <span className={sidebar_item_title}>{noUser.title}</span>
                  </NavLink>
                ))}
              {user &&
                userNavigation.map((user: { icon?: ReactNode; to: string; title: string }, index: number) => (
                  <NavLink className={sidebar_item} to={user.to} key={index}>
                    {user?.icon && <div className={sidebar_icon}>{user.icon}</div>}
                    <span className={sidebar_item_title}>{user.title}</span>
                  </NavLink>
                ))}
            </div>
          </AppShell.Sidebar>
        ))}
      <AppShell.Main>
        <AppShell.Header>
          <span className={header_title}>Artificer Toolkit</span>
          <div className={header_item_group}>
            {!user ? (
              !sm &&
              noUserNavigation.map((noUser: { to: string; title: string }, index: number) => (
                <NavLink
                  className={header_item}
                  to={noUser.to}
                  key={index}
                  title={noUser.title}
                  state={{ background: location, title: noUser.title }}
                >
                  {noUser.title}
                </NavLink>
              ))
            ) : (
              <Button
                style='unstyled'
                onClick={signOut}
                className={clsx(header_item, sprinkles({ me: 'space-1' }))}
                width='size-7'
              >
                <IUser />
              </Button>
            )}
            <Button style='unstyled' onClick={toggleTheme} className={header_item} width='size-7'>
              {themeType === 'light' ? <IDarkMode /> : <ILightMode />}
            </Button>
          </div>
        </AppShell.Header>
        <AppShell.Content>
          <Outlet />
        </AppShell.Content>
      </AppShell.Main>
    </AppShell>
  )
}

export default Layout
