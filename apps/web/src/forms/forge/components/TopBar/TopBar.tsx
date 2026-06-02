import { ActionIcon, Burger, TextInput, UnstyledButton } from '@mantine/core'
import { Bell, ChevronRight, FilePenLine, Search, Settings } from 'lucide-react'
import clsx from 'clsx'
import ILogo from '#assets/icons/ILogo'
import type { TopBarProps } from './TopBar.types'
import * as styles from './TopBar.css'

export function TopBar({
  accountLabel = 'Account',
  crumbs,
  isNavigationOpen,
  onNavigationToggle,
  statusLabel = 'Draft'
}: TopBarProps) {
  return (
    <header className={styles.root}>
      <div className={styles.leftCluster}>
        <Burger
          className={clsx(styles.iconButton, isNavigationOpen && styles.iconButtonPressed)}
          aria-controls='forge-structure-rail'
          aria-expanded={isNavigationOpen}
          aria-label={isNavigationOpen ? 'Collapse structure sidebar' : 'Open structure sidebar'}
          opened={isNavigationOpen}
          onClick={onNavigationToggle}
          size='sm'
        />
        <div className={styles.brand}>
          <ILogo className={styles.logo} size={24} aria-hidden='true' />
          <span className={styles.brandName}>Artificer Toolkit</span>
        </div>
        <span className={styles.divider} aria-hidden='true' />
        <nav className={styles.breadcrumbs} aria-label='Current authoring location'>
          {crumbs.map((crumb, index) => (
            <span className={styles.crumbGroup} key={`${crumb.label}-${index}`}>
              {index > 0 ? <ChevronRight className={styles.crumbSeparator} size={16} aria-hidden='true' /> : null}
              <span className={index === crumbs.length - 1 ? styles.crumbCurrent : styles.crumb}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
        <span className={styles.statusBadge}>
          <FilePenLine size={14} aria-hidden='true' />
          {statusLabel}
        </span>
      </div>
      <div className={styles.rightCluster}>
        <TextInput
          aria-label='Search commands'
          classNames={{
            input: styles.searchInput,
            root: styles.searchRoot,
            section: styles.searchSection,
            wrapper: styles.searchWrapper
          }}
          leftSection={<Search size={16} aria-hidden='true' />}
          placeholder='Search...'
          type='search'
        />
        <ActionIcon className={styles.iconButton} type='button' aria-label='Notifications' variant='transparent'>
          <Bell size={17} />
        </ActionIcon>
        <ActionIcon className={styles.iconButton} type='button' aria-label='Settings' variant='transparent'>
          <Settings size={17} />
        </ActionIcon>
        <span className={styles.divider} aria-hidden='true' />
        <UnstyledButton className={styles.accountButton} type='button'>
          <span className={styles.accountAvatar}>AT</span>
          <span className={styles.accountLabel}>{accountLabel}</span>
        </UnstyledButton>
      </div>
    </header>
  )
}
