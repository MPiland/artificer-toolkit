import { use } from 'react'
import ILogo from '@/assets/Icons/ILogo'
import { LayoutContext } from './LayoutContext'
import { useMediaQuery } from 'usehooks-ts'
import { Hamburger } from './Hamburger'
import { header, header_item, header_item_group, header_title } from './Header.css'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import Button from '@/components/Button'
import ThemeContext from '@/theme/ThemeContext'
import { sidebar_item } from './Sidebar.css'
import IDarkMode from '@/assets/Icons/IDarkMode'
import ILightMode from '@/assets/Icons/ILightMode'
import { noUserNavigation } from './Layout'

const NoAuthHeader = ({ lg }: { lg: boolean }) => {
  const { themeType, toggleTheme } = use(ThemeContext)
  const { collapsed, setCollapsed } = use(LayoutContext)
  return !lg ?
      <>
        <div className={header_item_group}>
          <Hamburger
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed((prev) => !prev)
            }}
            collapsed={collapsed}
          />
        </div>
        <div className={header_item_group}>
          <div className={header_title}>
            <ILogo />
            Artificer Toolkit
          </div>
          <Button style='unstyled' onClick={toggleTheme} className={sidebar_item} width='size-7'>
            {themeType === 'light' ?
              <IDarkMode />
            : <ILightMode />}
          </Button>
        </div>
      </>
    : <>
        <div className={header_item_group}>
          <Link to={'/'} className={header_title}>
            <ILogo />
            Artificer Toolkit
          </Link>
          <Button style='unstyled' onClick={toggleTheme} width='size-7'>
            {themeType === 'light' ?
              <IDarkMode />
            : <ILightMode />}
          </Button>
        </div>
        <div className={header_item_group}>
          {noUserNavigation.map((navItem, index) => (
            <Link className={header_item} to={navItem.to} params={navItem.params} key={index}>
              {navItem.title}
            </Link>
          ))}
        </div>
      </>
}

const AuthHeader = ({ lg }: { lg: boolean }) => {
  const { collapsed, setCollapsed } = use(LayoutContext)
  return (
    <>
      {!lg && (
        <div className={header_item_group}>
          <Hamburger
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed((prev) => !prev)
            }}
            collapsed={collapsed}
          />
        </div>
      )}
      <div className={header_item_group}>
        <Link to={'/home'} className={header_title}>
          Artificer Toolkit
          <ILogo />
        </Link>
      </div>
    </>
  )
}

const Header = ({ signedIn }: { signedIn: boolean }) => {
  const lg = useMediaQuery('screen and (min-width: 1025px)')

  return (
    <header className={clsx(header, { ['auth']: signedIn })}>
      {!signedIn ?
        <NoAuthHeader lg={lg} />
      : <AuthHeader lg={lg} />}
    </header>
  )
}

export default Header
