import { ActionIcon, Button, Drawer, Group, Menu, TextInput, UnstyledButton } from '@mantine/core'
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { useDisclosure, useHotkeys, useMediaQuery } from '@mantine/hooks'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useMemo, useState } from 'react'
import { BookOpen, LogOut, Moon, PlusCircle, Search, Sun } from 'lucide-react'
import clsx from 'clsx'
import IUser from '#assets/icons/IUser'
import { ShellHeaderSupplementContext, type ShellHeaderSupplement } from './headerSupplement'
import type { AppShellNavGroup, AppShellNavItem } from './navigation'
import { isNavItemActive } from './navigation'
import { Header } from './Header/Header'
import { MobileAppFooter } from './MobileAppFooter/MobileAppFooter'
import type {
  MobileAppFooterItem,
  MobileAppFooterMenuItem
} from './MobileAppFooter/MobileAppFooter.types'
import * as styles from './shell.css'

export interface ShellProps {
  navigation: AppShellNavGroup[]
  currentPath: string
  isAuthenticated?: boolean
  userEmail?: string | null
  children: ReactNode
}

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

type NavigationMenuItem = {
  href: string
  id: string
  isActive?: boolean
  label: string
}

export function Shell({
  navigation,
  currentPath,
  isAuthenticated,
  userEmail,
  children
}: ShellProps) {
  const [headerSupplement, setHeaderSupplement] = useState<ShellHeaderSupplement | null>(null)
  const [searchOpened, { close: closeSearch, open: openSearch }] = useDisclosure(false)
  const headerSupplementContext = useMemo(() => ({ setHeaderSupplement }), [])
  const isSignedIn = isAuthenticated ?? Boolean(userEmail)
  const hasLibraryNavigation = isSignedIn && navigation.length > 0
  const usesOverlayRail = useMediaQuery(
    '(max-width: 640px), (max-width: 900px) and (orientation: portrait)',
    false
  )
  const libraryItems = useMemo(
    () => toNavigationMenuItems(navigation, currentPath),
    [currentPath, navigation]
  )
  const createItems = useMemo(() => toCreateMenuItems(navigation), [navigation])
  const mobileFooterItems = useMemo(
    () =>
      toMobileFooterItems({
        accountMenuContent: <AccountMenuItems />,
        createItems,
        libraryItems,
        onSearchOpen: openSearch
      }),
    [openSearch, createItems, libraryItems]
  )
  const hasMobileFooter = usesOverlayRail && hasLibraryNavigation
  const appNavigationActions = hasLibraryNavigation ? (
    <AppNavigationMenus createItems={createItems} libraryItems={libraryItems} />
  ) : null

  return (
    <ShellHeaderSupplementContext value={headerSupplementContext}>
      <div className={styles.canvas} data-testid='app-shell'>
        <Header
          accountControl={isSignedIn ? <UserMenu /> : <SignedOutActions />}
          accountLabel={isSignedIn ? (userEmail ?? 'Account') : 'Sign in'}
          actions={headerSupplement?.actions}
          navigationActions={appNavigationActions}
          supplement={headerSupplement?.content}
        />
        {children}
        {hasMobileFooter ? <MobileAppFooter items={mobileFooterItems} /> : null}
        {hasMobileFooter ? (
          <MobileSearchDrawer opened={searchOpened} onClose={closeSearch} />
        ) : null}
      </div>
    </ShellHeaderSupplementContext>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderCopy}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  )
}

function UserMenu() {
  return (
    <Menu position='bottom-end' width={220} withinPortal>
      <Menu.Target>
        <ActionIcon
          className={styles.userIconButton}
          variant='default'
          aria-label='Open account menu'
        >
          <IUser size={18} aria-hidden='true' />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <AccountMenuItems />
      </Menu.Dropdown>
    </Menu>
  )
}

function AccountMenuItems() {
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('dark')
  const nextColorScheme = computedColorScheme === 'dark' ? 'light' : 'dark'

  return (
    <>
      <Menu.Item
        aria-label={`Switch to ${nextColorScheme} mode`}
        onClick={() => setColorScheme(nextColorScheme)}
        rightSection={
          <span className={styles.themeModePill} aria-hidden='true'>
            <span
              className={clsx(
                styles.themeModePillOption,
                computedColorScheme === 'light' && styles.themeModePillOptionActive
              )}
            >
              <Sun size={12} />
            </span>
            <span
              className={clsx(
                styles.themeModePillOption,
                computedColorScheme === 'dark' && styles.themeModePillOptionActive
              )}
            >
              <Moon size={12} />
            </span>
          </span>
        }
      >
        Theme
      </Menu.Item>
      <Menu.Item
        component={Link}
        to='/logout'
        leftSection={<LogOut size={16} aria-hidden='true' />}
      >
        Sign out
      </Menu.Item>
    </>
  )
}

function MobileSearchDrawer({ onClose, opened }: { onClose: () => void; opened: boolean }) {
  return (
    <Drawer
      classNames={{
        body: styles.searchDrawerBody,
        content: styles.searchDrawerContent,
        header: styles.searchDrawerHeader
      }}
      opened={opened}
      onClose={onClose}
      position='bottom'
      size='auto'
      title='Search'
      withinPortal
    >
      <div className={styles.searchDrawerStack}>
        <TextInput
          aria-label='Search the library'
          leftSection={<Search size={16} aria-hidden='true' />}
          placeholder='Search spells, races, classes...'
        />
        <Button type='button' disabled>
          Search
        </Button>
      </div>
    </Drawer>
  )
}

function AppNavigationMenus({
  createItems,
  libraryItems
}: {
  createItems: readonly NavigationMenuItem[]
  libraryItems: readonly NavigationMenuItem[]
}) {
  return (
    <Group gap='xs' wrap='nowrap'>
      <NavigationMenu
        icon={<BookOpen size={15} aria-hidden='true' />}
        items={libraryItems}
        label='Library'
      />
      <NavigationMenu
        icon={<PlusCircle size={15} aria-hidden='true' />}
        items={createItems}
        label='Create'
      />
    </Group>
  )
}

function NavigationMenu({
  icon,
  items,
  label
}: {
  icon: ReactNode
  items: readonly NavigationMenuItem[]
  label: string
}) {
  return (
    <Menu position='bottom-start' trigger='click-hover' width={230} withinPortal>
      <Menu.Target>
        <UnstyledButton className={styles.headerMenuButton} type='button'>
          {icon}
          <span>{label}</span>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item
            key={item.id}
            component={Link}
            to={item.href}
            aria-current={item.isActive ? 'page' : undefined}
          >
            <span className={styles.menuItemText}>
              <span>{item.label}</span>
            </span>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

function SignedOutActions() {
  return (
    <Group gap='xs' wrap='nowrap'>
      <Button component={Link} to='/sign-in' variant='default'>
        Sign in
      </Button>
      <Button component={Link} to='/sign-up'>
        Create account
      </Button>
    </Group>
  )
}

function toNavigationMenuItems(
  navigation: AppShellNavGroup[],
  currentPath: string
): readonly NavigationMenuItem[] {
  return navigation.flatMap((group) =>
    group.items.filter(hasHref).map((item) => ({
      href: item.href,
      id: item.href,
      isActive: isNavItemActive(item, currentPath),
      label: item.label
    }))
  )
}

function toCreateMenuItems(navigation: AppShellNavGroup[]): readonly NavigationMenuItem[] {
  return navigation.flatMap((group) =>
    group.items
      .filter(hasHref)
      .filter((item) => item.href !== '/home')
      .map((item) => ({
        href: `${item.href}/new`,
        id: `${item.href}/new`,
        label: item.label
      }))
  )
}

function toMobileFooterItems({
  accountMenuContent,
  createItems,
  libraryItems,
  onSearchOpen
}: {
  accountMenuContent: ReactNode
  createItems: readonly NavigationMenuItem[]
  libraryItems: readonly NavigationMenuItem[]
  onSearchOpen: () => void
}): readonly MobileAppFooterItem[] {
  return [
    {
      icon: 'library',
      id: 'library',
      label: 'Library',
      menuItems: toMobileMenuItems(libraryItems)
    },
    {
      icon: 'create',
      id: 'create',
      label: 'Create',
      menuItems: toMobileMenuItems(createItems)
    },
    {
      icon: 'search',
      id: 'search',
      label: 'Search',
      onClick: onSearchOpen
    },
    {
      icon: 'account',
      id: 'account',
      label: 'Account',
      menuContent: accountMenuContent
    }
  ]
}

function toMobileMenuItems(
  items: readonly NavigationMenuItem[]
): readonly MobileAppFooterMenuItem[] {
  return items.map((item) => ({
    href: item.href,
    id: item.id,
    isActive: item.isActive,
    label: item.label
  }))
}

function hasHref(item: AppShellNavItem): item is AppShellNavItem & { href: string } {
  return Boolean(item.href)
}
