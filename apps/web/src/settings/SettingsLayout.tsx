import { Drawer } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, useLocation } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import clsx from 'clsx'
import { type ReactNode, useEffect } from 'react'
import { settingsNavigation } from './settingsNavigation'
import * as styles from './settings.css'

function SettingsNavigation({
  onNavigate,
  className
}: {
  onNavigate?: () => void
  className?: string
}) {
  const location = useLocation()

  return (
    <nav className={clsx(styles.navigation, className)}>
      {settingsNavigation.map((item) => {
        const active =
          location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            className={clsx(styles.navigationLink, active && styles.navigationLinkActive)}
            to={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            <Icon size={19} aria-hidden='true' />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function SettingsLayout({ children, email }: { children: ReactNode; email: string }) {
  const location = useLocation()
  const [navigationOpened, { close: closeNavigation, open: openNavigation }] = useDisclosure(false)
  const currentSection = settingsNavigation.find(
    (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
  )?.label

  useEffect(() => {
    closeNavigation()
  }, [closeNavigation, location.pathname])

  return (
    <div className={styles.layout}>
      <aside className={styles.rail} aria-label='Settings navigation'>
        <div className={styles.railHeader}>
          <div className={styles.settingsTitle}>Settings</div>
          <p className={styles.settingsDescription}>
            Manage your profile, preferences, and account.
          </p>
          <p className={styles.accountEmail}>{email}</p>
        </div>
        <button
          type='button'
          className={styles.mobileHeaderToggle}
          aria-label='Open settings navigation'
          aria-expanded={navigationOpened}
          onClick={openNavigation}
        >
          <span className={styles.settingsMobileTitle}>{currentSection ?? 'Settings'}</span>
          <Menu size={20} aria-hidden='true' />
        </button>
        <SettingsNavigation className={styles.navigationHeader} />
      </aside>
      <Drawer
        opened={navigationOpened}
        onClose={closeNavigation}
        position='left'
        size='min(20rem, 88vw)'
        title='Settings navigation'
        withinPortal
        classNames={{
          body: styles.settingsDrawerBody,
          content: styles.settingsDrawerContent,
          header: styles.settingsDrawerHeader
        }}
      >
        <div className={styles.drawerRailHeader}>
          <div className={styles.settingsTitle}>Settings</div>
          <p className={styles.settingsDescription}>
            Manage your profile, preferences, and account.
          </p>
          <p className={styles.accountEmail}>{email}</p>
        </div>
        <SettingsNavigation onNavigate={closeNavigation} className={styles.navigationDrawer} />
      </Drawer>
      <div className={styles.contentPane}>{children}</div>
    </div>
  )
}
