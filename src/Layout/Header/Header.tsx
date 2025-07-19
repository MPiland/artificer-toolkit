import { AppShell, Group, Burger } from '@mantine/core'
import ILogo from '@/assets/Icons/ILogo'
import { base, groups, left_group, links, link, logo_icon, right_group, title } from './Header.css'
import SchemeToggle from '../SchemeToggle/SchemeToggle'
import Link from '@/components/Link'
import { noAuthLinks } from '../utils'

const Header = ({
  toggleMobile,
  mobileOpened,
  toggleDesktop,
  desktopOpened,
  toggleColorScheme,
  lg,
  signedIn,
}: {
  toggleMobile: () => void
  mobileOpened: boolean
  toggleDesktop: () => void
  desktopOpened: boolean
  toggleColorScheme: () => void
  lg: boolean
  signedIn: boolean
}) => {
  return (
    <AppShell.Header className={base}>
      <Group className={groups} justify={!signedIn ? 'space-between' : 'flex-start'}>
        {(signedIn || (!signedIn && !lg)) && (
          <Group justify={!signedIn && !lg ? 'space-between' : 'flex-start'}>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom='md' size='sm' />
            <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom='md' size='sm' />
          </Group>
        )}
        <Group className={left_group}>
          {/* Logo and scheme toggle */}
          {!signedIn && <SchemeToggle onClick={toggleColorScheme} />}
          <Link type='unstyled' to={'/home'} className={title}>
            <span>Artificer Toolkit</span>
            <ILogo className={logo_icon} />
          </Link>
        </Group>

        {/* Nav links */}
        {!signedIn && lg && (
          <>
            <Group className={links} gap={0}>
              {noAuthLinks.map((navItem, index) => (
                <Link type='unstyled' to={navItem.to} params={navItem.params} key={index} className={link}>
                  {navItem.title}
                </Link>
              ))}
            </Group>
            <Group className={right_group}>
              <Link to={'/login'} variant='default'>
                Login
              </Link>
              <Link to={'/register'}>Sign up</Link>
            </Group>
          </>
        )}
      </Group>
    </AppShell.Header>
  )
}

export default Header
