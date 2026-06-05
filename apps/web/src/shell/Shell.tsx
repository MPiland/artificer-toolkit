import { ActionIcon, Button, Drawer, Group, Menu, TextInput } from '@mantine/core'
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { useDisclosure, useHotkeys, useMediaQuery } from '@mantine/hooks'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { type ReactNode, useMemo, useState } from 'react'
import { BookOpen, LogOut, Moon, PlusCircle, Search, Sun } from 'lucide-react'
import IUser from '#assets/icons/IUser'
import {
  ShellHeaderSupplementContext,
  type ShellHeaderSupplement
} from './headerSupplement'
import type { AppShellNavGroup, AppShellNavItem } from './navigation'
import { isNavItemActive } from './navigation'
import { Header } from './Header/Header'
import { MobileAppFooter } from './MobileAppFooter/MobileAppFooter'
import type { MobileAppFooterItem, MobileAppFooterMenuItem } from './MobileAppFooter/MobileAppFooter.types'
import * as styles from './shell.css'

export interface ShellProps {
  navigation: AppShellNavGroup[]
  currentPath: string
  breadcrumbs?: string[]
  userEmail?: string | null
  children: ReactNode
}

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export interface FooterActionBarProps {
  summary: ReactNode
  actions: ReactNode
}

type NavigationMenuItem = {
  href: string
  id: string
  isActive?: boolean
  label: string
}

export function Shell({ breadcrumbs, navigation, currentPath, userEmail, children }: ShellProps) {
  const [headerSupplement, setHeaderSupplement] = useState<ShellHeaderSupplement | null>(null)
  const [searchOpened, { close: closeSearch, open: openSearch }] = useDisclosure(false)
  const headerSupplementContext = useMemo(() => ({ setHeaderSupplement }), [])
  const authoringChrome = headerSupplement?.authoringChrome
  const isAuthoringMode = Boolean(authoringChrome)
  const hasLibraryNavigation = Boolean(userEmail) && navigation.length > 0
  const usesOverlayRail = useMediaQuery(
    '(max-width: 640px), (max-width: 900px) and (orientation: portrait)',
    false
  )
  const activeItem = getActiveNavItem(navigation, currentPath)
  const fallbackCrumbs = breadcrumbs && breadcrumbs.length > 0
    ? breadcrumbs
    : [activeItem?.label ?? 'Home']
  const shellCrumbs = headerSupplement?.hideBreadcrumbLeaf
    ? fallbackCrumbs.slice(0, -1)
    : fallbackCrumbs
  const headerCrumbs = authoringChrome?.crumbs ?? shellCrumbs.map((label) => ({ label }))
  const libraryItems = useMemo(
    () => toNavigationMenuItems(navigation, currentPath),
    [
      currentPath,
      navigation
    ]
  )
  const createItems = useMemo(() => toCreateMenuItems(navigation), [navigation])
  const mobileFooterItems = useMemo(
    () => toMobileFooterItems({
      accountMenuContent: <AccountMenuItems />,
      createItems,
      libraryItems,
      onSearchOpen: openSearch
    }),
    [
      openSearch,
      createItems,
      libraryItems
    ]
  )
  const isNavigationOpen = authoringChrome?.isNavigationOpen ?? false
  const hasInlineNavigation = !usesOverlayRail && Boolean(authoringChrome) && isNavigationOpen
  const hasMobileFooter = usesOverlayRail && hasLibraryNavigation
  const appNavigationActions = hasLibraryNavigation ? (
    <AppNavigationMenus createItems={createItems} libraryItems={libraryItems} />
  ) : null

  useHotkeys([
    [
      'Escape',
      () => {
        if (authoringChrome?.isNavigationOpen) authoringChrome.onNavigationClose()
      }
    ]
  ])

  return (
    <ShellHeaderSupplementContext value={headerSupplementContext}>
      <div className={styles.canvas} data-testid='app-shell'>
        <Header
          accountControl={userEmail ? <UserMenu /> : <SignedOutActions />}
          accountLabel={userEmail ?? 'Sign in'}
          crumbs={headerCrumbs}
          isNavigationOpen={isNavigationOpen}
          navigationActions={appNavigationActions}
          navigationLabel='structure sidebar'
          onNavigationToggle={authoringChrome?.onNavigationToggle ?? (() => undefined)}
          showNavigationButton={Boolean(authoringChrome)}
          statusLabel={authoringChrome?.statusLabel}
        />
        {usesOverlayRail && authoringChrome ? (
          <Drawer
            classNames={{
              body: styles.navigationDrawerBody,
              content: styles.navigationDrawerContent
            }}
            opened={isNavigationOpen}
            onClose={authoringChrome.onNavigationClose}
            position='left'
            size='min(20rem, 86vw)'
            withCloseButton={false}
            aria-label='Authoring navigation'
          >
            <div className={styles.navigationDrawerRailMount} id='authoring-navigation'>
              {authoringChrome.mobileRail}
            </div>
          </Drawer>
        ) : null}
        <div className={clsx(styles.workspace, !hasInlineNavigation && styles.workspaceNoRail)}>
          {hasInlineNavigation && authoringChrome ? (
            <div
              className={styles.railSlot}
              id='authoring-navigation'
            >
              {authoringChrome.desktopRail}
            </div>
          ) : null}
          <main
            id='main-content'
            className={isAuthoringMode ? styles.authoringMain : styles.main}
            tabIndex={-1}
          >
            {isAuthoringMode ? children : <div className={styles.contentArea}>{children}</div>}
          </main>
        </div>
        {hasMobileFooter ? (
          <div className={styles.mobileFooterSlot}>
            <MobileAppFooter items={mobileFooterItems} />
          </div>
        ) : null}
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

export function FooterActionBar({ summary, actions }: FooterActionBarProps) {
  return (
    <footer className={styles.footerActionBar}>
      <div>{summary}</div>
      <Group gap='sm'>{actions}</Group>
    </footer>
  )
}

function UserMenu() {
  return (
    <Menu position='bottom-end' width={220} withinPortal>
      <Menu.Target>
        <ActionIcon className={styles.userIconButton} variant='default' aria-label='Open account menu'>
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
  const ThemeIcon = nextColorScheme === 'dark' ? Moon : Sun

  return (
    <>
      <Menu.Item
        leftSection={<ThemeIcon size={16} aria-hidden='true' />}
        onClick={() => setColorScheme(nextColorScheme)}
      >
        Switch to {nextColorScheme} mode
      </Menu.Item>
      <Menu.Item component={Link} to='/logout' leftSection={<LogOut size={16} aria-hidden='true' />}>
        Sign out
      </Menu.Item>
    </>
  )
}

function MobileSearchDrawer({ onClose, opened }: { onClose: () => void, opened: boolean }) {
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
        <Button
          className={styles.headerMenuButton}
          leftSection={icon}
          size='compact-sm'
          variant='subtle'
        >
          {label}
        </Button>
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

function getActiveNavItem(navigation: AppShellNavGroup[], currentPath: string) {
  for (const group of navigation) {
    const item = group.items.find((navItem) => isNavItemActive(navItem, currentPath))

    if (item) return item
  }

  return null
}

function toNavigationMenuItems(navigation: AppShellNavGroup[], currentPath: string): readonly NavigationMenuItem[] {
  return navigation.flatMap((group) =>
    group.items
      .filter(hasHref)
      .map((item) => ({
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

function toMobileMenuItems(items: readonly NavigationMenuItem[]): readonly MobileAppFooterMenuItem[] {
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
