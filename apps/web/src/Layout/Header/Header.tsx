import { AppShell, Group, Burger } from '@mantine/core'
import ILogo from '@assets/Icons/ILogo'
import {
  base,
  groups,
  left_group,
  links,
  link,
  logo_icon,
  right_group,
  title,
  utility_group,
} from './Header.css'
import SchemeToggle from '../SchemeToggle/SchemeToggle'
import Link from '@components/Link'
import { noAuthLinks } from '../utils'

const Header = ({
  toggleMobile,
  mobileOpened,
  toggleColorScheme,
  lg,
  signedIn,
}: {
  toggleMobile: () => void
  mobileOpened: boolean
  toggleColorScheme: () => void
  lg: boolean
  signedIn: boolean
}) => {
  return (
    <AppShell.Header className={base}>
      <Group className={groups} justify='space-between'>
        {(signedIn || (!signedIn && !lg)) && (
          <Group justify={!signedIn && !lg ? 'space-between' : 'flex-start'}>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom='md' size='sm' />
          </Group>
        )}
        <Group className={left_group}>
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
              <SchemeToggle onClick={toggleColorScheme} />
              <Link to={'/sign-in'} variant='default'>
                Sign in
              </Link>
              <Link to={'/sign-up'}>Sign up</Link>
            </Group>
          </>
        )}

        {signedIn && (
          <Group className={utility_group}>
            <SchemeToggle onClick={toggleColorScheme} />
          </Group>
        )}

        {!signedIn && !lg && (
          <Group className={utility_group}>
            <SchemeToggle onClick={toggleColorScheme} />
          </Group>
        )}
      </Group>
    </AppShell.Header>
  )
}

export default Header
