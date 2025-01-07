import AppShell from '../components/AppShell/AppShell'
import { ReactNode, useEffect, use } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  header_title,
  header_item,
  header_item_group,
  sidebar_item_group,
  sidebar_item,
  sidebar_icon,
  sidebar_item_title,
  sidebar_header,
  sidebar_footer,
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
import Dropdown from '../components/Dropdown/Dropdown'
import { useListSystemsQuery } from '../features/systems/systemsApi'
import useSystemPref from '../hooks/useSystemPref'
import ThemeContext from '../theme/ThemeContext'
import ILogo from '../assets/Icons/ILogo'
import { LoadingContext } from '../components/Loading/LoadingContext'
import { LayoutContext } from './LayoutContext'

const SignedIn = () => {
  const [systemPref, setSystemPref] = useSystemPref()
  const { themeType, toggleTheme } = use(ThemeContext)
  const { setIsLoading } = use(LoadingContext)
  const { collapsed, setCollapsed } = use(LayoutContext)

  const { mutateAsync: signOut } = useSignOut()
  const { data: systems } = useListSystemsQuery()

  useEffect(() => {
    setIsLoading((prev) => prev && !systems)
  }, [systems, setIsLoading])

  useEffect(() => {
    if (systemPref === '' || (systems?.length > 0 && !systems?.find((system) => system.id === systemPref))) {
      const defaultSystem = systems?.find((system) => system.value === 'dnd5e2014').id
      if (defaultSystem) {
        setSystemPref(defaultSystem)
      }
    }
  }, [systemPref, systems, setSystemPref])

  const handleSystemChange = (e: { type: 'update'; value: string }) => {
    localStorage.setItem('selectedSystem', e.value)
    setSystemPref(e.value)
  }

  const sm = useMediaQuery('screen and (max-width: 567px)')
  const md = useMediaQuery('screen and (max-width: 1024px)')
  const lg = !sm && !md

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
    <>
      {lg && (
        <AppShell.Sidebar collapsed={collapsed}>
          <div>
            <div className={sidebar_header}>
              <AppShell.Hamburger onClick={() => setCollapsed((prev) => !prev)} collapsed={collapsed} />
            </div>
            <div className={sidebar_item_group}>
              {userNavigation.map((user: { icon?: ReactNode; to: string; title: string }, index: number) => (
                <NavLink className={sidebar_item} to={user.to} key={index}>
                  {user?.icon && <div className={sidebar_icon}>{user.icon}</div>}
                  {!collapsed && <span className={sidebar_item_title}>{user.title}</span>}
                </NavLink>
              ))}
            </div>
          </div>
          <div>
            {!collapsed && (
              <Dropdown
                name='system'
                options={systems}
                className={sprinkles({ mb: 'space-2' })}
                onChange={(e) => handleSystemChange(e as { type: 'update'; value: string })}
                value={systemPref}
              />
            )}
            <div className={sidebar_footer}>
              <Button style='unstyled' onClick={signOut} className={clsx(header_item, sprinkles({ mx: 'space-2' }))}>
                <IUser /> {!collapsed && <span className={sprinkles({ mx: 'space-2' })}>Sign Out</span>}
              </Button>
              {!collapsed && (
                <Button style='unstyled' onClick={toggleTheme} className={header_item} width='size-7'>
                  {themeType === 'light' ? <IDarkMode /> : <ILightMode />}
                </Button>
              )}
            </div>
          </div>
        </AppShell.Sidebar>
      )}
      {!lg && (
        <AppShell.Header>
          <div className={header_item_group}>
            <AppShell.Hamburger onClick={() => setCollapsed((prev) => !prev)} collapsed={collapsed} />
            <div className={header_title}>
              Artificer Toolkit
              <ILogo />
            </div>
          </div>
        </AppShell.Header>
      )}
      <AppShell.Main>
        {lg && (
          <AppShell.Header>
            <div className={header_item_group}>
              <div className={header_title}>
                Artificer Toolkit
                <ILogo />
              </div>
            </div>
          </AppShell.Header>
        )}
        {!lg && (
          <AppShell.Sidebar collapsed={collapsed}>
            <div className={sidebar_item_group}>
              {userNavigation.map((user: { icon?: ReactNode; to: string; title: string }, index: number) => (
                <NavLink className={sidebar_item} to={user.to} key={index}>
                  {user?.icon && <div className={sidebar_icon}>{user.icon}</div>}
                  <span className={sidebar_item_title}>{user.title}</span>
                </NavLink>
              ))}
            </div>
            <div>
              <Dropdown
                name='system'
                options={systems}
                className={sprinkles({ mb: 'space-2' })}
                onChange={(e) => handleSystemChange(e as { type: 'update'; value: string })}
                value={systemPref}
              />
              <div className={sidebar_footer}>
                <Button style='unstyled' onClick={signOut} className={clsx(header_item, sprinkles({ mx: 'space-2' }))}>
                  <IUser /> <span className={sprinkles({ mx: 'space-2' })}>Sign Out</span>
                </Button>

                <Button style='unstyled' onClick={toggleTheme} className={header_item} width='size-7'>
                  {themeType === 'light' ? <IDarkMode /> : <ILightMode />}
                </Button>
              </div>
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

export default SignedIn
