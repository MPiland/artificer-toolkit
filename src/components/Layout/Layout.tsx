import AppShell from '../AppShell/AppShell'
import { FC, useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useSendLogoutMutation } from '../../features/auth/authApiSlice'
import {
  header_title,
  header_item,
  header_item_group,
  header_nav_item,
  sidebar_item_group,
} from './Layout.css'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import { useMediaQuery } from 'usehooks-ts'

interface LayoutProps {
  token?: string | null
}

const Layout: FC<LayoutProps> = ({ token }) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)

  const location = useLocation()
  const navigate = useNavigate()

  const sm = useMediaQuery('(max-width: 567px)')

  const sidebarRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sidebarCurrent = sidebarRef.current
    const hamburgerCurrent = hamburgerRef.current

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        !sidebarCurrent?.contains(event.target as Node) &&
        !hamburgerCurrent?.contains(event.target as Node)
      ) {
        setSidebarOpen(false)
      }
    }

    document?.addEventListener('mousedown', handleOutsideClick)

    return () => document?.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const [sendLogout] = useSendLogoutMutation()

  const handleLogout = async () => {
    try {
      sendLogout()
      setSidebarOpen(false)
    } catch (err: any) {
      console.log(err.data.message)
    } finally {
      navigate('/')
    }
  }

  const handleClick = () => {
    if (sm) {
      setSidebarOpen((prev) => !prev)
    }
  }

  const noTokenNavigation = (
    <ul className={sm ? sidebar_item_group : header_item_group}>
      <li className={header_item}>
        <NavLink to='' className={header_nav_item}>
          Media
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink to='' className={header_nav_item}>
          Pricing
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink to='' className={header_nav_item}>
          About
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink
          className={header_nav_item}
          to='register'
          state={{ background: location, title: 'Register' }}
          onClick={handleClick}
        >
          Register
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink
          className={header_nav_item}
          to='login'
          state={{ background: location, title: 'Login' }}
          onClick={handleClick}
        >
          Login
        </NavLink>
      </li>
    </ul>
  )

  const tokenNavigation = (
    <ul className={sm ? sidebar_item_group : header_item_group}>
      <NavLink className={header_nav_item} to='characters'>
        <li className={header_item}>Characters</li>
      </NavLink>
      <NavLink className={header_nav_item} to='classes' onClick={handleClick}>
        <li className={header_item}>Classes</li>
      </NavLink>
      <NavLink className={header_nav_item} to='races' onClick={handleClick}>
        <li className={header_item}>Races</li>
      </NavLink>
      <NavLink className={header_nav_item} to='spells' onClick={handleClick}>
        <li className={header_item}>Spells</li>
      </NavLink>
      <NavLink className={header_nav_item} to='items' onClick={handleClick}>
        <li className={header_item}>Items</li>
      </NavLink>
      <NavLink to='' className={header_nav_item} onClick={handleClick}>
        <li className={header_item}>Backgrounds</li>
      </NavLink>
      <NavLink className={header_nav_item} to='feats' onClick={handleClick}>
        <li className={header_item}>Feats</li>
      </NavLink>
      <NavLink to='' className={header_nav_item} onClick={handleClick}>
        <li className={header_item}>Monsters</li>
      </NavLink>
      <NavLink to='' className={header_nav_item} onClick={handleClick}>
        <li className={header_item}>Campaigns</li>
      </NavLink>
      <li
        className={clsx(header_item, sprinkles({ bc: 'red-4' }))}
        onClick={() => {
          handleClick()
          handleLogout()
        }}
      >
        Logout
      </li>
    </ul>
  )

  return (
    <AppShell>
      <AppShell.Header>
        {!sm ? (
          !token ? (
            noTokenNavigation
          ) : (
            tokenNavigation
          )
        ) : (
          <AppShell.Hamburger
            onClick={() => {
              setSidebarOpen((prev) => !prev)
            }}
            isActive={sidebarOpen}
            hamburgerRef={hamburgerRef}
          />
        )}
        <span className={header_title}>Artificer Toolkit</span>
      </AppShell.Header>
      <AppShell.Sidebar
        isActive={!token && !sm ? false : sidebarOpen}
        sidebarRef={sidebarRef}
      >
        {token && sm && tokenNavigation}
        {!token && sm && noTokenNavigation}
      </AppShell.Sidebar>
      <AppShell.Main sidebarActive={!token && !sm ? false : sidebarOpen}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}

export default Layout
