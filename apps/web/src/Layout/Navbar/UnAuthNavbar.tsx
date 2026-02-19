import { AppShell, Group, Burger, Divider } from '@mantine/core'
import { link_label, link as navbar_link } from './Navbar.css'
import * as header from '../Header/Header.css'
import clsx from 'clsx'
import { startCase } from 'lodash-es'
import Link from '@components/Link'
import { noAuthLinks } from '../utils'

const UnAuthNavbar = ({ toggleMobile, mobileOpened }: { toggleMobile: () => void; mobileOpened: boolean }) => {
  return (
    <>
      <AppShell.Section className={header.base}>
        <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom='md' size='sm' />
      </AppShell.Section>
      <AppShell.Section>
        {noAuthLinks.map((link, index) => (
          <Link
            type='unstyled'
            className={clsx(navbar_link, { ['collapsed']: !mobileOpened })}
            to={link.to}
            key={index}
          >
            <span className={clsx(link_label, { ['hidden']: !mobileOpened })}>{startCase(link.title)}</span>
          </Link>
        ))}
      </AppShell.Section>
      <Divider my='sm' />
      <AppShell.Section>
        <Group grow px='md'>
          <Link to={'/login'} variant='default' onClick={() => toggleMobile()}>
            Log in
          </Link>
          <Link to={'/register'} onClick={() => toggleMobile()}>
            Sign up
          </Link>
        </Group>
      </AppShell.Section>
    </>
  )
}

export default UnAuthNavbar
