import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import {
  AppShell,
  Group,
  Burger,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
  Avatar,
  Text,
  Flex,
  Menu,
  ActionIcon,
  Divider,
} from '@mantine/core'
import ILogo from '@/assets/Icons/ILogo'
import { Outlet, type ToOptions, type NavigateOptions, useNavigate } from '@tanstack/react-router'
import { use, Suspense, type ReactNode, useEffect } from 'react'
import { AuthContext } from '@/pages/auth/AuthContext'
import {
  header_title,
  navbar_links,
  navbar,
  navbar_link,
  navbar_link_icon,
  navbar_link_label,
  navbar_link_tooltip,
  navbar_footer,
  layout_toggle_scheme_icon,
  header,
  layout,
  navbar_header,
  user_button,
  user_button_chevron,
  user_button_title,
  user_button_email,
  navbar_link_icon_wrapper,
  user_button_avatar,
  user_button_avatar_img,
  header_links,
  header_link,
  header_groups,
  header_left_group,
  user_menu,
  header_right_group,
  header_logo_icon,
  header_burger,
  main,
} from './Layout.css'
import Loading from '@/components/Loading'
import CharactersIcon from '@/assets/Icons/IChar'
import ClassesIcon from '@/assets/Icons/IClass'
import RacesIcon from '@/assets/Icons/IRaces'
import ScrollIcon from '@/assets/Icons/IScroll'
import SackIcon from '@/assets/Icons/ISack'
import FeatsIcon from '@/assets/Icons/IFeat'
import BackstoryIcon from '@/assets/Icons/IBackstory'
import type { FormType } from '@/types'
import clsx from 'clsx'
import { startCase } from 'lodash'
import { Sun, Moon, ChevronRight, LogOut } from 'lucide-react'
import Link from '@/components/Link'
import { signOut } from '@/apis/auth.api'
import { ModalContext } from '@/components/Modal'

const Layout = () => {
  const navigate = useNavigate()
  const [sidebarOpen, { toggle: toggleSidebar }] = useDisclosure()
  const { user, isAuthenticating, isLoading } = use(AuthContext)
  const { showModal, hideModal } = use(ModalContext)
  const signedIn = !isAuthenticating && user != null

  const md = useMediaQuery('(min-width: 769px) and (max-width: 992px)')
  const lg = useMediaQuery('(min-width: 993px)')
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })

  useEffect(() => {
    if (isLoading) {
      showModal({
        type: 'loading',
      })
    }
    if (!isLoading) {
      hideModal()
    }
  }, [hideModal, showModal, isLoading])

  const noAuthLinks: { to: ToOptions['to']; params?: NavigateOptions['params']; title: string }[] = [
    {
      to: '/',
      title: 'Media',
    },
    {
      to: '/',
      title: 'Pricing',
    },
    {
      to: '/',
      title: 'About',
    },
  ]

  const authLinks: { icon?: ReactNode; to: ToOptions['to']; title: FormType }[] = [
    { icon: <CharactersIcon className={navbar_link_icon} />, to: '/characters', title: 'characters' },
    {
      icon: <ClassesIcon className={navbar_link_icon} />,
      to: '/classes',
      title: 'classes',
    },
    {
      icon: <RacesIcon className={navbar_link_icon} />,
      to: '/races',
      title: 'races',
    },
    {
      icon: <ScrollIcon className={navbar_link_icon} />,
      to: '/spells',
      title: 'spells',
    },
    {
      icon: <SackIcon className={navbar_link_icon} />,
      to: '/equipment',
      title: 'equipment',
    },
    {
      icon: <BackstoryIcon className={navbar_link_icon} />,
      to: '/backgrounds',
      title: 'backgrounds',
    },
    {
      icon: <FeatsIcon className={navbar_link_icon} />,
      to: '/feats',
      title: 'feats',
    },
  ]

  const SchemeToggle = ({ onClick }: { onClick?: () => void }) => {
    return (
      <ActionIcon component='div' variant='outline' onClick={onClick}>
        <Sun className={clsx(layout_toggle_scheme_icon, { ['hide']: computedColorScheme === 'dark' })} />
        <Moon className={clsx(layout_toggle_scheme_icon, { ['hide']: computedColorScheme === 'light' })} />
      </ActionIcon>
    )
  }

  const UserButton = () => {
    return (
      <Menu position='right-end' portalProps={{ target: '#app-shell' }} trigger='click-hover'>
        <Menu.Target>
          <Group className={user_button}>
            <Avatar
              src='https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-8.png'
              classNames={{
                root: user_button_avatar,
                image: user_button_avatar_img,
              }}
            />

            <Flex direction='column' justify='flex-start'>
              <Text className={user_button_title}>Harriette Spoonlicker</Text>

              <Text className={user_button_email}>hspoonlicker@outlook.com</Text>
            </Flex>

            <ChevronRight className={user_button_chevron} />
          </Group>
        </Menu.Target>

        <Menu.Dropdown className={user_menu}>
          <Menu.Item
            leftSection={<LogOut />}
            onClick={async () => {
              await signOut()
              return navigate({ to: '/home' })
            }}
          >
            Logout
          </Menu.Item>
          <Menu.Item
            leftSection={<SchemeToggle />}
            closeMenuOnClick={false}
            onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
          >
            Toggle Light/Dark Mode
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    )
  }

  const AuthNavbar = () => {
    return (
      <AppShell.Navbar className={clsx(navbar, { ['collapsed']: !sidebarOpen || lg })}>
        <AppShell.Section className={navbar_header} hiddenFrom='md'>
          <Group>
            <Burger opened={sidebarOpen} onClick={toggleSidebar} hiddenFrom={!signedIn ? 'sm' : 'md'} size='sm' />
          </Group>
        </AppShell.Section>
        <AppShell.Section className={navbar_links}>
          {authLinks.map((link, index) => (
            <Tooltip
              label={startCase(link.title)}
              key={index}
              disabled={sidebarOpen}
              position='right'
              offset={12}
              className={navbar_link_tooltip}
              portalProps={{ target: '#app-shell' }}
            >
              <Link
                type='unstyled'
                className={clsx(navbar_link, { ['collapsed']: !sidebarOpen })}
                to={link.to}
                state={{ form: link.title }}
                key={index}
              >
                {link?.icon && (
                  <Flex justify='center' align='center' className={navbar_link_icon_wrapper}>
                    {link.icon}
                  </Flex>
                )}
                <span className={clsx(navbar_link_label, { ['hidden']: !sidebarOpen })}>{startCase(link.title)}</span>
              </Link>
            </Tooltip>
          ))}
        </AppShell.Section>
        <AppShell.Section className={navbar_footer}>
          <UserButton />
        </AppShell.Section>
      </AppShell.Navbar>
    )
  }

  const UnAuthNavbar = () => {
    return (
      <AppShell.Navbar className={clsx(navbar, { ['collapsed']: !sidebarOpen || md || lg }, 'unAuth')}>
        <AppShell.Section className={navbar_header} hiddenFrom='md'>
          <Burger opened={sidebarOpen} onClick={toggleSidebar} hiddenFrom={!signedIn ? 'sm' : 'md'} size='sm' />
        </AppShell.Section>
        <AppShell.Section>
          {noAuthLinks.map((link, index) => (
            <Link
              type='unstyled'
              className={clsx(navbar_link, { ['collapsed']: !sidebarOpen })}
              to={link.to}
              key={index}
            >
              <span className={clsx(navbar_link_label, { ['hidden']: !sidebarOpen })}>{startCase(link.title)}</span>
            </Link>
          ))}
        </AppShell.Section>
        <Divider my='sm' />
        <AppShell.Section>
          <Group grow px='md'>
            <Link to={'/login'} variant='default' onClick={() => toggleSidebar()}>
              Log in
            </Link>
            <Link to={'/register'} onClick={() => toggleSidebar()}>
              Sign up
            </Link>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>
    )
  }

  return (
    <AppShell
      layout={!lg ? 'alt' : 'default'}
      header={{ height: 60 }}
      navbar={{
        width: 'fit-content',
        breakpoint: 'sm',
        collapsed: { mobile: !sidebarOpen || lg, desktop: !sidebarOpen || lg },
      }}
      padding='md'
      id='app-shell'
      className={clsx(layout, { ['unAuth']: !signedIn })}
    >
      <AppShell.Header className={clsx(header)}>
        <Group className={header_groups} justify={!signedIn ? 'space-between' : 'flex-start'}>
          <Group className={header_burger} hiddenFrom={!signedIn ? 'sm' : 'sm'}>
            <Burger opened={sidebarOpen} onClick={toggleSidebar} size='sm' />
          </Group>
          <Group className={header_left_group}>
            {/* Logo and scheme toggle */}
            {!signedIn && (
              <SchemeToggle onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')} />
            )}
            <Link type='unstyled' to={'/home'} className={header_title}>
              <span>Artificer Toolkit</span>
              <ILogo className={header_logo_icon} />
            </Link>
          </Group>

          {/* Nav links */}
          {!isLoading && !signedIn && (
            <>
              <Group className={header_links} gap={0} visibleFrom='sm'>
                {noAuthLinks.map((navItem, index) => (
                  <Link type='unstyled' to={navItem.to} params={navItem.params} key={index} className={header_link}>
                    {navItem.title}
                  </Link>
                ))}
              </Group>
              <Group className={header_right_group} visibleFrom='sm'>
                <Link to={'/login'} variant='default'>
                  Login
                </Link>
                <Link to={'/register'}>Sign up</Link>
              </Group>
            </>
          )}
        </Group>
      </AppShell.Header>
      {signedIn ?
        <AuthNavbar />
      : <UnAuthNavbar />}
      <AppShell.Main className={main}>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </AppShell.Main>
    </AppShell>
  )
}

export default Layout
