import { use, useState, ReactNode, useEffect } from 'react'
import { LayoutContext } from './LayoutContext'
import { Link, ToOptions } from '@tanstack/react-router'
import {
  sidebar_item_group,
  sidebar_item,
  sidebar_item_title,
  sidebar_header,
  sidebar_icon,
  sidebar_footer,
  sidebar,
  sidebar_upper,
} from './Sidebar.css'
import { useMediaQuery } from 'usehooks-ts'
import Floating from '../components/Floating/Floating'
import CharactersIcon from '../assets/Icons/IChar'
import ClassesIcon from '../assets/Icons/IClass'
import RacesIcon from '../assets/Icons/IRaces'
import Button from '../components/Button/Button'
import ScrollIcon from '../assets/Icons/IScroll'
import SackIcon from '../assets/Icons/ISack'
import FeatsIcon from '../assets/Icons/IFeat'
import BackstoryIcon from '../assets/Icons/IBackstory'
import Dropdown from '../components/Dropdown/Dropdown'
import { sprinkles } from '../css/sprinkles.css'
import IDarkMode from '../assets/Icons/IDarkMode'
import ILightMode from '../assets/Icons/ILightMode'
import IUser from '../assets/Icons/IUser'
import ThemeContext from '../theme/ThemeContext'
import { useSignOut } from '../apis/authApi'
import useSystemPref from '../hooks/useSystemPref'
import clsx from 'clsx'
import { useListSystemsQuery } from '../apis/systemsApi'
import { Hamburger } from './Hamburger'
import { noUserNavigation } from './Layout'

const NoAuthSidebar = () => {
  const { collapsed } = use(LayoutContext)

  return (
    <nav className={clsx(sidebar, { ['collapsed']: collapsed })}>
      <div className={sidebar_item_group}>
        {noUserNavigation.map((noUser, index) => (
          <Link className={sidebar_item} to={noUser.to} params={noUser.params} key={index}>
            <span className={sidebar_item_title}>{noUser.title}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}

const AuthSidebar = ({ lg }: { lg: boolean }) => {
  const { collapsed, setCollapsed } = use(LayoutContext)
  const { themeType, toggleTheme } = use(ThemeContext)
  const [systemPref, setSystemPref] = useSystemPref()

  const [toolTipOpen, setToolTipOpen] = useState<boolean[]>([])

  const { mutateAsync: signOut } = useSignOut()
  const { data: systems } = useListSystemsQuery()

  useEffect(() => {
    if (systems?.length && (systemPref === '' || !systems?.find((system) => system.id === systemPref))) {
      const defaultSystem = systems?.find((system) => system?.value === 'dnd5e2014')?.id
      if (defaultSystem) {
        setSystemPref(defaultSystem)
      }
    }
  }, [systemPref, systems, setSystemPref])

  const handleSystemChange = (e: { type: 'update'; value: string }) => {
    localStorage.setItem('selectedSystem', e.value)
    setSystemPref(e.value)
  }

  const userNavigation: { icon?: ReactNode; to: ToOptions['to']; title: string }[] = [
    { icon: <CharactersIcon className={sidebar_icon} />, to: '/characters', title: 'Characters' },
    {
      icon: <ClassesIcon className={sidebar_icon} />,
      to: '/classes',
      title: 'Classes',
    },
    {
      icon: <RacesIcon className={sidebar_icon} />,
      to: '/races',
      title: 'Races',
    },
    {
      icon: <ScrollIcon className={sidebar_icon} />,
      to: '/spells',
      title: 'Spells',
    },
    {
      icon: <SackIcon className={sidebar_icon} />,
      to: '/equipment',
      title: 'Equipment',
    },
    {
      icon: <BackstoryIcon className={sidebar_icon} />,
      to: '/backgrounds',
      title: 'Backgrounds',
    },
    {
      icon: <FeatsIcon className={sidebar_icon} />,
      to: '/feats',
      title: 'Feats',
    },
  ]

  return (
    <nav className={clsx(sidebar, { ['collapsed']: collapsed })}>
      {lg ?
        <>
          <div className={sidebar_upper}>
            <div className={sidebar_header}>
              <Hamburger
                onClick={(e) => {
                  e.stopPropagation()
                  setCollapsed((prev) => !prev)
                }}
                collapsed={collapsed}
              />
            </div>
            <div className={sidebar_item_group}>
              {userNavigation.map((user, index) => (
                <Floating key={index}>
                  <Link
                    className={clsx(sidebar_item, { ['collapsed']: collapsed })}
                    to={user.to}
                    key={index}
                    onMouseOver={() =>
                      setToolTipOpen((prev) => {
                        const newArray = [...prev]
                        newArray[index] = true
                        return newArray
                      })
                    }
                    onMouseLeave={() =>
                      setToolTipOpen((prev) => {
                        const newArray = [...prev]
                        newArray[index] = false
                        return newArray
                      })
                    }
                  >
                    {user?.icon && user.icon}
                    {!collapsed && <span className={sidebar_item_title}>{user.title}</span>}
                    {collapsed && toolTipOpen[index] && (
                      <Floating.Anchor>
                        <Floating.Tooltip boundary='app' placement='right' open={true}>
                          {user.title}
                        </Floating.Tooltip>
                      </Floating.Anchor>
                    )}
                  </Link>
                </Floating>
              ))}
            </div>
          </div>
          <div className={sidebar_item_group}>
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
              <Button style='unstyled' onClick={signOut} className={clsx(sidebar_item)}>
                <IUser /> {!collapsed && <span className={sprinkles({ mx: 'space-2' })}>Sign Out</span>}
              </Button>
              {!collapsed && (
                <Button style='unstyled' onClick={toggleTheme} className={sidebar_item} width='size-7'>
                  {themeType === 'light' ?
                    <IDarkMode />
                  : <ILightMode />}
                </Button>
              )}
            </div>
          </div>
        </>
      : <>
          <div className={sidebar_item_group}>
            {userNavigation.map((user, index) => (
              <Link className={sidebar_item} to={user.to} key={index}>
                {user?.icon && <div className={sidebar_icon}>{user.icon}</div>}
                <span className={sidebar_item_title}>{user.title}</span>
              </Link>
            ))}
          </div>
          <div className={sidebar_item_group}>
            <Dropdown
              name='system'
              options={systems}
              className={sprinkles({ mb: 'space-2' })}
              onChange={(e) => handleSystemChange(e as { type: 'update'; value: string })}
              value={systemPref}
            />
            <div className={sidebar_footer}>
              <Button style='unstyled' onClick={signOut} className={clsx(sidebar_item, sprinkles({ mx: 'space-2' }))}>
                <IUser /> <span className={sprinkles({ mx: 'space-2' })}>Sign Out</span>
              </Button>

              <Button style='unstyled' onClick={toggleTheme} className={sidebar_item} width='size-7'>
                {themeType === 'light' ?
                  <IDarkMode />
                : <ILightMode />}
              </Button>
            </div>
          </div>
        </>
      }
    </nav>
  )
}

const Sidebar = ({ signedIn }: { signedIn: boolean }) => {
  const lg = useMediaQuery('screen and (min-width: 1025px)')

  return !signedIn ? !lg && <NoAuthSidebar /> : <AuthSidebar lg={lg} />
}
export default Sidebar
