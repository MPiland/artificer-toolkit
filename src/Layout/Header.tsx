import { use } from 'react'
import ILogo from '../assets/Icons/ILogo'
import { LayoutContext } from './LayoutContext'
import { useMediaQuery } from 'usehooks-ts'
import { Hamburger } from './Hamburger'
import { header, header_item, header_item_group, header_title } from './Header.css'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

const NoAuthHeader = ({ lg }: { lg: boolean }) => {
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
      to: 'sign-in',
      title: 'Sign In',
    },
    {
      to: 'sign-up',
      title: 'Sign Up',
    },
  ]
  const { collapsed, setCollapsed } = use(LayoutContext)
  return !lg ? (
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
      </div>
    </>
  ) : (
    <>
      <div className={header_item_group}>
        <div className={header_title}>
          <ILogo />
          Artificer Toolkit
        </div>
      </div>
      <div className={header_item_group}>
        {noUserNavigation.map((navItem, index) => (
          <NavLink className={header_item} to={navItem.to} key={index}>
            {navItem.title}
          </NavLink>
        ))}
      </div>
    </>
  )
}

const AuthHeader = ({ lg }: { lg: boolean }) => {
  const { collapsed, setCollapsed } = use(LayoutContext)
  return !lg ? (
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
          Artificer Toolkit
          <ILogo />
        </div>
      </div>
    </>
  ) : (
    <div className={header_item_group}>
      <div className={header_title}>
        Artificer Toolkit
        <ILogo />
      </div>
    </div>
  )
}

const Header = ({ signedIn }: { signedIn: boolean }) => {
  const lg = useMediaQuery('screen and (min-width: 1025px)')

  return (
    <header className={clsx(header, { ['auth']: signedIn })}>
      {!signedIn ? <NoAuthHeader lg={lg} /> : <AuthHeader lg={lg} />}
    </header>
  )
}

export default Header
