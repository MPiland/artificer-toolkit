import { AppShell, Group, Burger, Tooltip, Flex } from '@mantine/core'
import { useEffect } from 'react'
import {
  links,
  link_icon_wrapper,
  link as navbar_link,
  link_label,
  link_pill,
  link_tooltip,
  footer,
} from './Navbar.css'
import * as header from '../Header/Header.css'
import { startCase } from 'lodash-es'
import Link from '@components/Link'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchSystems } from '@apis'
import { useSystemPref } from '@hooks'
import User from '../User/User'
import { authLinks } from '../utils'

const AuthNavbar = ({
  toggleMobile,
  mobileOpened,
  authUser,
  lg,
}: {
  toggleMobile: () => void
  mobileOpened: boolean
  authUser: unknown
  lg: boolean
}) => {
  const [systemPref, setSystemPref] = useSystemPref()
  const { data: systems } = useSuspenseQuery(fetchSystems())

  useEffect(() => {
    if (authUser) {
      if (systems?.length && (systemPref === '' || !systems?.find((system) => system.id === systemPref))) {
        const defaultSystem = systems?.find((system) => system.label === 'DND5e2014') || systems[0]
        if (defaultSystem?.id) {
          setSystemPref(defaultSystem.id)
        }
      }
    }
  }, [systems, setSystemPref, systemPref, authUser])

  return (
    <>
      <AppShell.Section className={header.base} hiddenFrom='md'>
        <Group>
          <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom='md' size='sm' />
        </Group>
      </AppShell.Section>
      <AppShell.Section className={links}>
        {authLinks.map((link, index) => (
          <Tooltip
            label={startCase(link.title)}
            key={index}
            disabled={!lg}
            position='right'
            offset={8}
            className={link_tooltip}
            portalProps={{ target: '#app-shell' }}
          >
            <Link
              type='unstyled'
              className={navbar_link}
              to={link.to}
              state={{ form: link.title }}
              key={index}
              onClick={() => {
                if (!lg && mobileOpened) toggleMobile()
              }}
            >
              {link?.icon && (
                <span className={link_pill}>
                  <Flex justify='center' align='center' className={link_icon_wrapper}>
                    {link.icon}
                  </Flex>
                </span>
              )}
              {!lg && <span className={link_label}>{startCase(link.title)}</span>}
            </Link>
          </Tooltip>
        ))}
      </AppShell.Section>
      <AppShell.Section className={footer}>
        <User lg={lg} />
      </AppShell.Section>
    </>
  )
}

export default AuthNavbar
