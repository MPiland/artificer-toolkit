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
import { FaRegCircleUser } from 'react-icons/fa6'
import { MdDarkMode, MdLightMode } from 'react-icons/md'
import { useTheme } from '../hooks/useTheme'
import Button from '../components/Button/Button'
import ScrollIcon from '../assets/Icons/IScroll'
import SackIcon from '../assets/Icons/ISack'
import useAuth from '../hooks/useAuth'

const Layout = () => {
  const [token] = useAuth()
  const location = useLocation()

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  const { themeType, toggleTheme } = useTheme()

  const sm = useMediaQuery('screen and (max-width: 567px)')

  const noTokenNavigation: { to: string; title: string }[] = [
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
      to: 'login',
      title: 'Login',
    },
  ]

  const tokenNavigation: { icon?: ReactNode; to: string; title: string }[] = [
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

  return (
    <AppShell>
      {(!token && sm) ||
        (token && (
          <AppShell.Sidebar collapsed={sidebarCollapsed}>
            <div className={sidebar_header}>
              <AppShell.Hamburger onClick={() => setSidebarCollapsed((prev) => !prev)} collapsed={sidebarCollapsed} />
            </div>
            <div className={sidebar_item_group}>
              {!token &&
                sm &&
                noTokenNavigation.map((noToken: { to: string; title: string }, index: number) => (
                  <NavLink className={sidebar_item} to={noToken.to} key={index}>
                    <span className={sidebar_item_title}>{noToken.title}</span>
                  </NavLink>
                ))}
              {token &&
                tokenNavigation.map((token: { icon?: ReactNode; to: string; title: string }, index: number) => (
                  <NavLink className={sidebar_item} to={token.to} key={index}>
                    {token?.icon && <div className={sidebar_icon}>{token.icon}</div>}
                    <span className={sidebar_item_title}>{token.title}</span>
                  </NavLink>
                ))}
            </div>
          </AppShell.Sidebar>
        ))}
      <AppShell.Main>
        <AppShell.Header>
          <span className={header_title}>Artificer Toolkit</span>
          <div className={header_item_group}>
            {!token &&
              !sm &&
              noTokenNavigation.map((noToken: { to: string; title: string }, index: number) => (
                <NavLink
                  className={header_item}
                  to={noToken.to}
                  key={index}
                  title={noToken.title}
                  state={{ background: location, title: noToken.title }}
                >
                  {noToken.title}
                </NavLink>
              ))}
            <div className={header_item}>
              <FaRegCircleUser />
            </div>
            <Button type='button' style='unstyled' onClick={toggleTheme} className={header_item}>
              {themeType === 'light' ? <MdDarkMode /> : <MdLightMode />}
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
