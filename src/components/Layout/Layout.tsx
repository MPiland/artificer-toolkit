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
import { useMediaQuery, useEventListener } from 'usehooks-ts'

interface LayoutProps {
  token?: string | null
}

const Layout: FC<LayoutProps> = ({ token }) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [showHamburger, setShowHamburger] = useState<boolean>()

  const location = useLocation()
  const navigate = useNavigate()

  const sm = useMediaQuery('screen and (max-width: 567px)')
  const md = useMediaQuery(
    'screen and (min-width: 568px) and (max-width: 1023px)'
  )

  const sidebarRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLDivElement>(null)

  const handleOutsideClick = (event: MouseEvent) => {
    const sidebarCurrent = sidebarRef.current
    const hamburgerCurrent = hamburgerRef.current
    if (
      !sidebarCurrent?.contains(event.target as Node) &&
      !hamburgerCurrent?.contains(event.target as Node)
    ) {
      setSidebarOpen(false)
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setSidebarOpen(false)
    }
  }

  useEventListener('click', handleOutsideClick)
  useEventListener('keyup', handleKeyUp)

  useEffect(() => {
    if (sm && !token) {
      setShowHamburger(true)
    } else if ((sm || md) && token) {
      setShowHamburger(true)
    } else {
      setShowHamburger(false)
    }
  }, [md, sm, token])

  console.log('showHamburger', showHamburger)

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
    if (sm || md) {
      setSidebarOpen((prev) => !prev)
    }
  }

  const noTokenNavigation = (
    <ul
      className={
        !token && showHamburger ? sidebar_item_group : header_item_group
      }
    >
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
    <ul
      className={
        token && showHamburger ? sidebar_item_group : header_item_group
      }
    >
      <li className={header_item}>
        <NavLink className={header_nav_item} to='characters'>
          Characters
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink className={header_nav_item} to='classes' onClick={handleClick}>
          Classes
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink className={header_nav_item} to='races' onClick={handleClick}>
          Races
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink className={header_nav_item} to='spells' onClick={handleClick}>
          Spells
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink className={header_nav_item} to='items' onClick={handleClick}>
          Items
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink to='' className={header_nav_item} onClick={handleClick}>
          Backgrounds
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink className={header_nav_item} to='feats' onClick={handleClick}>
          Feats
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink to='' className={header_nav_item} onClick={handleClick}>
          Monsters
        </NavLink>
      </li>
      <li className={header_item}>
        <NavLink to='' className={header_nav_item} onClick={handleClick}>
          Campaigns
        </NavLink>
      </li>
      <li className={header_item} onClick={handleLogout}>
        Logout
      </li>
    </ul>
  )

  return (
    <AppShell>
      <AppShell.Header>
        {!token && !showHamburger
          ? noTokenNavigation
          : token && !showHamburger
          ? tokenNavigation
          : showHamburger && (
              <AppShell.Hamburger
                onClick={handleClick}
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
        {!token && showHamburger && noTokenNavigation}
        {token && showHamburger && tokenNavigation}
      </AppShell.Sidebar>
      <AppShell.Main sidebarActive={!token && !sm ? false : sidebarOpen}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}

export default Layout
