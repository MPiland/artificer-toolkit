import {
  ActionIcon,
  Button,
  Drawer,
  Group,
  Menu,
  SegmentedControl,
  TextInput,
  UnstyledButton,
  useMantineColorScheme
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { Link, useHydrated } from '@tanstack/react-router'
import { Fragment, type ReactNode, useMemo, useState } from 'react'
import {
  BookOpen,
  LogOut,
  Monitor,
  Moon,
  PlusCircle,
  Search,
  Settings,
  Sun,
  UsersRound
} from 'lucide-react'
import clsx from 'clsx'
import IUser from '#assets/icons/IUser'
import { useMediaImage } from '#app/data/media'
import { ShellHeaderSupplementContext, type ShellHeaderSupplement } from './headerSupplement'
import type { AppShellNavGroup, AppShellNavItem } from './navigation'
import { isNavItemActive } from './navigation'
import { Header } from './Header/Header'
import { MobileAppFooter } from './MobileAppFooter/MobileAppFooter'
import { SentryFeedbackMenuItem } from './SentryFeedbackMenuItem'
import { ShellReturnHrefContext } from './returnLocation'
import {
  NotificationDesktopAction,
  NotificationMobileAction
} from '#app/notifications/NotificationShellActions'
import { useNotificationAvailability } from '#app/notifications/notificationContext'
import type {
  MobileAppFooterItem,
  MobileAppFooterMenuItem
} from './MobileAppFooter/MobileAppFooter.types'
import * as styles from './shell.css'

interface ShellProps {
  navigation: AppShellNavGroup[]
  currentPath: string
  currentHref?: string
  isAuthenticated?: boolean
  libraryImportEnabled?: boolean
  publicSignUpEnabled?: boolean
  userEmail?: string | null
  children: ReactNode
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

type NavigationMenuItem = {
  dividerBefore?: boolean
  href: string
  id: string
  isActive?: boolean
  label: string
}

export function Shell({
  navigation,
  currentPath,
  currentHref = currentPath,
  isAuthenticated,
  libraryImportEnabled = false,
  publicSignUpEnabled = false,
  userEmail,
  children
}: ShellProps) {
  const [headerSupplement, setHeaderSupplement] = useState<ShellHeaderSupplement | null>(null)
  const notificationsAvailable = useNotificationAvailability() === 'ready'
  const [searchOpened, { close: closeSearch, open: openSearch }] = useDisclosure(false)
  const headerSupplementContext = useMemo(() => ({ setHeaderSupplement }), [])
  const isSignedIn = isAuthenticated ?? Boolean(userEmail)
  const hasLibraryNavigation = isSignedIn && navigation.length > 0
  const usesOverlayRail = useMediaQuery(
    '(max-width: 640px), (max-width: 900px) and (orientation: portrait)',
    false
  )
  const libraryItems = useMemo(
    () => [
      ...toNavigationMenuItems(navigation, currentPath).filter((item) => item.href !== '/social'),
      ...(libraryImportEnabled
        ? [
            {
              dividerBefore: true,
              href: '/library/import',
              id: 'library-import',
              isActive: currentPath === '/library/import',
              label: 'Import'
            }
          ]
        : [])
    ],
    [currentPath, libraryImportEnabled, navigation]
  )
  const libraryNotes = useMemo(
    () => navigation.flatMap((group) => (group.emptyLabel ? [group.emptyLabel] : [])),
    [navigation]
  )
  const createItems = useMemo(() => toCreateMenuItems(navigation), [navigation])
  const socialHubActive = currentPath === '/social' || currentPath.startsWith('/social/')
  const mobileFooterItems = useMemo(
    () =>
      toMobileFooterItems({
        accountMenuContent: <AccountMenuItems />,
        createItems,
        libraryItems,
        onSearchOpen: openSearch,
        socialHubActive
      }),
    [openSearch, createItems, libraryItems, socialHubActive]
  )
  const hasMobileFooter = usesOverlayRail && hasLibraryNavigation
  const authoring = isAuthoringPath(currentPath)
  const [returnHref, setReturnHref] = useState<string | undefined>(
    authoring ? undefined : currentHref
  )
  if (!authoring && returnHref !== currentHref) setReturnHref(currentHref)
  const usesWideContent = isCharacterSheetPath(currentPath)
  const appNavigationActions = hasLibraryNavigation ? (
    <AppNavigationMenus
      createItems={createItems}
      libraryItems={libraryItems}
      libraryNotes={libraryNotes}
      socialHubActive={socialHubActive}
    />
  ) : null
  const content = authoring ? (
    <main className={styles.authoringMain} data-testid='app-shell-main'>
      {children}
    </main>
  ) : (
    <main className={styles.main} data-testid='app-shell-main'>
      <div
        className={clsx(styles.contentArea, usesWideContent && styles.contentAreaWide)}
        data-testid='app-shell-content'
      >
        {children}
      </div>
    </main>
  )
  const headerActions =
    notificationsAvailable || headerSupplement?.actions ? (
      <Group gap='xs' wrap='nowrap'>
        {notificationsAvailable ? <NotificationDesktopAction /> : null}
        {headerSupplement?.actions}
      </Group>
    ) : undefined
  const mobileActions =
    notificationsAvailable || headerSupplement?.authoringChrome?.mobileActions ? (
      <Group gap='xs' wrap='nowrap'>
        {headerSupplement?.authoringChrome?.mobileActions}
        {notificationsAvailable ? <NotificationMobileAction /> : null}
      </Group>
    ) : undefined

  return (
    <ShellReturnHrefContext value={returnHref}>
      <ShellHeaderSupplementContext value={headerSupplementContext}>
        <div className={styles.canvas} data-testid='app-shell'>
          <Header
            accountControl={
              isSignedIn ? (
                <UserMenu />
              ) : (
                <SignedOutActions publicSignUpEnabled={publicSignUpEnabled} />
              )
            }
            accountLabel={isSignedIn ? (userEmail ?? 'Account') : 'Sign in'}
            actions={headerActions}
            mobileActions={mobileActions}
            navigationActions={appNavigationActions}
            supplement={headerSupplement?.content}
          />
          {content}
          {hasMobileFooter ? <MobileAppFooter items={mobileFooterItems} /> : null}
          {hasMobileFooter ? (
            <MobileSearchDrawer opened={searchOpened} onClose={closeSearch} />
          ) : null}
        </div>
      </ShellHeaderSupplementContext>
    </ShellReturnHrefContext>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <div className={styles.pageHeaderTitleRow}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
      {description ? <p className={styles.pageDescription}>{description}</p> : null}
    </header>
  )
}

function UserMenu() {
  const hydrated = useHydrated()
  const avatarQuery = useMediaImage(
    { lookup: { type: 'ACCOUNT_AVATAR' }, attach: { type: 'ACCOUNT_AVATAR' } },
    'THUMBNAIL'
  )

  return (
    <Menu position='bottom-end' width={180} withinPortal>
      <Menu.Target>
        <ActionIcon
          className={styles.userIconButton}
          variant='default'
          aria-label='Open account menu'
          disabled={!hydrated}
        >
          {avatarQuery.data ? (
            <img alt='' className={styles.userAvatarImage} src={avatarQuery.data.url} />
          ) : (
            <IUser size={18} aria-hidden='true' />
          )}
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <AccountMenuItems />
      </Menu.Dropdown>
    </Menu>
  )
}

function AccountMenuItems() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  return (
    <>
      <Menu.Label>Theme</Menu.Label>
      <SegmentedControl
        aria-label='Theme preference'
        className={styles.themeSelector}
        classNames={{
          label: styles.themeSelectorLabel,
          innerLabel: styles.themeSelectorOption
        }}
        data={[
          {
            label: <Monitor size={13} aria-hidden='true' />,
            value: 'auto'
          },
          {
            label: <Sun size={13} aria-hidden='true' />,
            value: 'light'
          },
          {
            label: <Moon size={13} aria-hidden='true' />,
            value: 'dark'
          }
        ]}
        fullWidth
        size='xs'
        value={colorScheme}
        onChange={(value) => setColorScheme(value === 'light' || value === 'dark' ? value : 'auto')}
      />
      <Menu.Item
        component={Link}
        to='/settings'
        leftSection={<Settings size={16} aria-hidden='true' />}
      >
        Settings
      </Menu.Item>
      <SentryFeedbackMenuItem />
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
  libraryItems,
  libraryNotes,
  socialHubActive
}: {
  createItems: readonly NavigationMenuItem[]
  libraryItems: readonly NavigationMenuItem[]
  libraryNotes: readonly string[]
  socialHubActive: boolean
}) {
  return (
    <Group gap='xs' wrap='nowrap'>
      <NavigationMenu
        icon={<BookOpen size={15} aria-hidden='true' />}
        items={libraryItems}
        label='Library'
        notes={libraryNotes}
      />
      <NavigationMenu
        icon={<PlusCircle size={15} aria-hidden='true' />}
        items={createItems}
        label='Create'
      />
      <UnstyledButton
        component={Link}
        to='/social'
        aria-current={socialHubActive ? 'page' : undefined}
        className={clsx(styles.headerMenuButton, socialHubActive && styles.headerMenuButtonActive)}
      >
        <UsersRound size={15} aria-hidden='true' />
        <span>Social Hub</span>
      </UnstyledButton>
    </Group>
  )
}

function NavigationMenu({
  icon,
  items,
  label,
  notes = []
}: {
  icon: ReactNode
  items: readonly NavigationMenuItem[]
  label: string
  notes?: readonly string[]
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
          <Fragment key={item.id}>
            {item.dividerBefore ? <Menu.Divider /> : null}
            <Menu.Item
              component={Link}
              to={item.href}
              aria-current={item.isActive ? 'page' : undefined}
            >
              <span className={styles.menuItemText}>
                <span>{item.label}</span>
              </span>
            </Menu.Item>
          </Fragment>
        ))}
        {notes.map((note) => (
          <Menu.Label key={note}>{note}</Menu.Label>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

function SignedOutActions({ publicSignUpEnabled }: { publicSignUpEnabled: boolean }) {
  return (
    <Group gap='xs' wrap='nowrap'>
      <Button component={Link} to='/sign-in' variant='default'>
        Sign in
      </Button>
      {publicSignUpEnabled ? (
        <Button component={Link} to='/sign-up'>
          Create account
        </Button>
      ) : null}
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
      .filter((item) => item.href !== '/home' && item.href !== '/social')
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
  onSearchOpen,
  socialHubActive
}: {
  accountMenuContent: ReactNode
  createItems: readonly NavigationMenuItem[]
  libraryItems: readonly NavigationMenuItem[]
  onSearchOpen: () => void
  socialHubActive: boolean
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
      href: '/social',
      icon: 'social',
      id: 'social',
      isActive: socialHubActive,
      label: 'Social'
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
    dividerBefore: item.dividerBefore,
    href: item.href,
    id: item.id,
    isActive: item.isActive,
    label: item.label
  }))
}

function hasHref(item: AppShellNavItem): item is AppShellNavItem & { href: string } {
  return Boolean(item.href)
}

function isAuthoringPath(pathname: string): boolean {
  return pathname.endsWith('/new') || pathname.endsWith('/edit')
}

function isCharacterSheetPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  return segments[0] === 'characters' && segments.length >= 3 && !isAuthoringPath(pathname)
}
