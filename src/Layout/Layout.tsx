import AppShell from '../components/AppShell/AppShell'
import { ReactNode, useEffect, useState, use } from 'react'
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
import Button from '../components/Button/Button'
import ScrollIcon from '../assets/Icons/IScroll'
import SackIcon from '../assets/Icons/ISack'
import { sprinkles } from '../css/sprinkles.css'
import clsx from 'clsx'
import { useSignOut } from '../features/auth/authApi'
import IDarkMode from '../assets/Icons/IDarkMode'
import ILightMode from '../assets/Icons/ILightMode'
import IUser from '../assets/Icons/IUser'
import Spinner from '../components/Spinner/Spinner'
import Loading from '../components/Loading/Loading'
import Dropdown from '../components/Dropdown/Dropdown'
import { useListSystemsQuery } from '../features/systems/systemsApi'
import useSystemPref from '../hooks/useSystemPref'
import ThemeContext from '../theme/ThemeContext'
import { LoadingContext } from '../components/Loading/LoadingContext'
import { AuthContext } from '../features/auth/AuthContext'
import ILogo from '../assets/Icons/ILogo'

const Layout = () => {
  const { user, isAuthenticating, isLoading: isUserLoading } = use(AuthContext)
  const location = useLocation()
  const [systemPref, setSystemPref] = useSystemPref()
  const { isLoading, setIsLoading } = use(LoadingContext)
  const { themeType, toggleTheme } = use(ThemeContext)
  const { mutateAsync: signOut } = useSignOut()
  const { data: systems } = useListSystemsQuery()
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)

  useEffect(() => {
    if (systemPref === '' || (systems?.length > 0 && !systems?.find((system) => system.id === systemPref))) {
      const defaultSystem = systems?.find((system) => system.value === 'dnd5e2014').id
      if (defaultSystem) {
        setSystemPref(defaultSystem)
      }
    }
  }, [systemPref, systems, setSystemPref])

  useEffect(() => {
    setIsLoading((prev) => prev && (isUserLoading || (!systems && !isUserLoading && user !== null)))
  }, [isUserLoading, systems, setIsLoading, user])

  const handleSystemChange = (e: { type: 'update'; value: string }) => {
    localStorage.setItem('selectedSystem', e.value)
    setSystemPref(e.value)
  }

  const sm = useMediaQuery('screen and (max-width: 567px)')

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
      to: 'equipment',
      title: 'Equipment',
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
      {(isAuthenticating || user || (!isAuthenticating && !user && sm)) && (
        <AppShell.Sidebar collapsed={sidebarCollapsed}>
          <div className={sidebar_header}>
            <AppShell.Hamburger onClick={() => setSidebarCollapsed((prev) => !prev)} collapsed={sidebarCollapsed} />
          </div>
          <div className={sidebar_item_group}>
            {!isAuthenticating &&
              !user &&
              sm &&
              noUserNavigation.map((noUser: { to: string; title: string }, index: number) => (
                <NavLink className={sidebar_item} to={noUser.to} key={index}>
                  <span className={sidebar_item_title}>{noUser.title}</span>
                </NavLink>
              ))}
            {(isAuthenticating || user) &&
              userNavigation.map((user: { icon?: ReactNode; to: string; title: string }, index: number) => (
                <NavLink className={sidebar_item} to={user.to} key={index}>
                  {user?.icon && <div className={sidebar_icon}>{user.icon}</div>}
                  <span className={sidebar_item_title}>{user.title}</span>
                </NavLink>
              ))}
          </div>
        </AppShell.Sidebar>
      )}
      <AppShell.Main>
        <AppShell.Header>
          <div className={header_title}>
            <ILogo />
            Artificer Toolkit
          </div>
          <div className={header_item_group}>
            {!isAuthenticating && !user ? (
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
              <>
                <Dropdown
                  name='system'
                  options={systems}
                  onChange={(e) => handleSystemChange(e as { type: 'update'; value: string })}
                  value={systemPref}
                />
                <Button
                  style='unstyled'
                  onClick={signOut}
                  className={clsx(header_item, sprinkles({ mx: 'space-2' }))}
                  width='size-7'
                >
                  <IUser />
                </Button>
              </>
            )}
            <Button style='unstyled' onClick={toggleTheme} className={header_item} width='size-7'>
              {themeType === 'light' ? <IDarkMode /> : <ILightMode />}
            </Button>
          </div>
        </AppShell.Header>
        {isAuthenticating && !user ? (
          <Spinner />
        ) : (
          <AppShell.Content>
            <Outlet />
          </AppShell.Content>
        )}
      </AppShell.Main>
      {isLoading && <Loading />}
    </AppShell>
  )
}

export default Layout
