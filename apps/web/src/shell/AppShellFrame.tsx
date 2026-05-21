import { ActionIcon, AppShell, Burger, Button, Group, Menu, ScrollArea, Tooltip } from '@mantine/core'
import { useDisclosure, useHotkeys } from '@mantine/hooks'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import ILogo from '#assets/icons/ILogo'
import IUser from '#assets/icons/IUser'
import { ThemeToggle } from '#ui/primitives'
import type { AppShellNavGroup, AppShellNavItem } from './navigation'
import { isNavItemActive } from './navigation'
import {
  ShellHeaderSupplementContext,
  type ShellHeaderSupplement
} from './headerSupplement'
import * as styles from './shell.css'

export interface AppShellFrameProps {
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

export function AppShellFrame({
  breadcrumbs,
  navigation,
  currentPath,
  userEmail,
  children
}: AppShellFrameProps) {
  const [opened, { toggle, close }] = useDisclosure(false)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const wasOpenedRef = useRef(false)
  const [headerSupplement, setHeaderSupplement] = useState<ShellHeaderSupplement | null>(null)
  const headerSupplementContext = useMemo(() => ({ setHeaderSupplement }), [])
  const activeItem = getActiveNavItem(navigation, currentPath)
  const breadcrumbLabels = breadcrumbs && breadcrumbs.length > 0
    ? breadcrumbs
    : [activeItem?.label ?? 'Home']
  const shellBreadcrumbLabels = headerSupplement?.hideBreadcrumbLeaf
    ? breadcrumbLabels.slice(0, -1)
    : breadcrumbLabels

  useHotkeys([
    [
      'Escape', () => {
        if (opened) {
          close()
        }
      }
    ]
  ])

  useEffect(() => {
    if (wasOpenedRef.current && !opened) {
      burgerRef.current?.focus()
    }

    wasOpenedRef.current = opened
  }, [opened])

  return (
    <ShellHeaderSupplementContext value={headerSupplementContext}>
      <AppShell
        className={styles.shellRoot}
        data-testid='app-shell'
        header={{ height: 48 }}
        navbar={{
          width: { base: 288, md: 48 },
          breakpoint: 'md',
          collapsed: { mobile: !opened }
        }}
        padding={0}
      >
        <a className={styles.skipLink} href='#main-content'>
          Skip to workspace
        </a>
        <AppShell.Header className={styles.header}>
          <Link className={styles.logoCell} to='/home' aria-label='Go to workspace home'>
            <ILogo size={36} />
          </Link>
          <div className={styles.headerBar}>
            <Group gap='sm' className={styles.mobileHeaderGroup}>
              <Burger
                ref={burgerRef}
                opened={opened}
                onClick={toggle}
                aria-controls='workspace-navigation'
                aria-label={opened ? 'Close navigation' : 'Open navigation'}
                size='sm'
              />
            </Group>
            <div className={styles.breadcrumb} aria-label='Current section'>
              {shellBreadcrumbLabels.map((label, index) => (
                <span className={styles.breadcrumbSegment} key={`${label}-${index}`}>
                  {index > 0 ? <span className={styles.breadcrumbSlash}>/</span> : null}
                  <span className={index === shellBreadcrumbLabels.length - 1 && !headerSupplement ? styles.breadcrumbLeaf : styles.breadcrumbRoot}>
                    {label}
                  </span>
                </span>
              ))}
              {headerSupplement
                ? (
                    <span className={styles.breadcrumbSegment}>
                      {shellBreadcrumbLabels.length > 0 ? <span className={styles.breadcrumbSlash}>/</span> : null}
                      <span className={styles.breadcrumbSupplement}>{headerSupplement.content}</span>
                    </span>
                  )
                : null}
            </div>
            <Group gap='xs' className={styles.headerActions}>
              {headerSupplement?.actions}
              <ThemeToggle />
              <span className={styles.headerUserMenu}>
                <UserMenu userEmail={userEmail} />
              </span>
            </Group>
          </div>
        </AppShell.Header>

        <AppShell.Navbar id='workspace-navigation' className={styles.navbar} aria-label='Workspace navigation'>
          <NavigationList navigation={navigation} currentPath={currentPath} onNavigate={close} />
          <UserRailAction userEmail={userEmail} />
        </AppShell.Navbar>

        <AppShell.Main id='main-content' className={styles.main} tabIndex={-1}>
          <div className={styles.contentArea}>
            {children}
          </div>
        </AppShell.Main>
      </AppShell>
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

function NavigationList({
  navigation,
  currentPath,
  onNavigate
}: {
  navigation: AppShellNavGroup[]
  currentPath: string
  onNavigate?: () => void
}) {
  return (
    <ScrollArea className={styles.navScroll} type='hover' offsetScrollbars={false}>
      <nav aria-label='Primary navigation'>
        <div className={styles.navStack}>
          {navigation.map((group) => (
            <section className={styles.navGroup} key={group.label}>
              <span className={styles.navGroupLabel}>{group.label}</span>
              {group.items.map((item) => (
                <NavigationItem
                  key={item.label}
                  item={item}
                  active={isNavItemActive(item, currentPath)}
                  onNavigate={onNavigate}
                />
              ))}
            </section>
          ))}
        </div>
      </nav>
    </ScrollArea>
  )
}

function getActiveNavItem(navigation: AppShellNavGroup[], currentPath: string) {
  for (const group of navigation) {
    const item = group.items.find((navItem) => isNavItemActive(navItem, currentPath))

    if (item) {
      return item
    }
  }

  return null
}

function NavigationItem({
  item,
  active,
  onNavigate
}: {
  item: AppShellNavItem
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const className = clsx(styles.navItem, item.href && styles.navItemInteractive, active && styles.navItemActive, !item.href && styles.navItemDisabled)
  const content = (
    <>
      <span className={styles.navIcon}>
        <Icon size={24} />
      </span>
      <span className={styles.navItemLabel}>{item.label}</span>
    </>
  )

  if (!item.href) {
    return (
      <Tooltip label={`${item.label} is coming later`} position='right' withArrow>
        <button className={className} type='button' disabled aria-label={`${item.label} is coming later`}>
          {content}
        </button>
      </Tooltip>
    )
  }

  return (
    <Tooltip label={item.label} position='right' withArrow>
      <Link
        to={item.href}
        className={className}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
        onClick={onNavigate}
      >
        {content}
      </Link>
    </Tooltip>
  )
}

function UserRailAction({ userEmail }: { userEmail?: string | null }) {
  return (
    <div className={styles.sidebarFooter}>
      <Tooltip label={userEmail ?? 'Account'} position='right' withArrow>
        <span>
          <UserMenu userEmail={userEmail} compact />
        </span>
      </Tooltip>
    </div>
  )
}

function UserMenu({
  userEmail,
  compact = false
}: {
  userEmail?: string | null
  compact?: boolean
}) {
  const label = userEmail ?? 'Account'

  return (
    <Menu position='bottom-end' width={220}>
      <Menu.Target>
        {compact
          ? (
              <ActionIcon className={styles.userIconButton} variant='default' aria-label={label}>
                <IUser size={20} />
              </ActionIcon>
            )
          : (
              <Button variant='default' leftSection={<IUser size={20} />} title={label}>
                {label}
              </Button>
            )}
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Session</Menu.Label>
        <Menu.Item component={Link} to='/logout'>
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
