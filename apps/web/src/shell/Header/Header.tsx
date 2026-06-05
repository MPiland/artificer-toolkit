import { ActionIcon, Burger, TextInput, UnstyledButton } from '@mantine/core'
import { ChevronRight, FilePenLine, Search } from 'lucide-react'
import clsx from 'clsx'
import ILogo from '#assets/icons/ILogo'
import IUser from '#assets/icons/IUser'
import type { HeaderProps } from './Header.types'
import * as styles from './Header.css'

export function Header({
  accountControl,
  accountLabel = 'Account',
  actions,
  crumbs,
  isNavigationOpen,
  navigationActions,
  navigationButtonRef,
  navigationLabel = 'navigation',
  onNavigationToggle,
  showNavigationButton = true,
  statusLabel
}: HeaderProps) {
  return (
    <header className={styles.root}>
      <div className={styles.leftCluster}>
        {showNavigationButton ? (
          <Burger
            ref={navigationButtonRef}
            className={clsx(styles.iconButton, isNavigationOpen && styles.iconButtonPressed)}
            aria-controls='forge-structure-rail'
            aria-expanded={isNavigationOpen}
            aria-label={isNavigationOpen ? `Collapse ${navigationLabel}` : `Open ${navigationLabel}`}
            opened={isNavigationOpen}
            onClick={onNavigationToggle}
            size='sm'
          />
        ) : null}
        <div className={styles.brand}>
          <ILogo className={styles.logo} size={36} aria-hidden='true' />
          <span className={styles.brandName}>Artificer Toolkit</span>
        </div>
        <span className={styles.divider} aria-hidden='true' />
        <nav className={styles.breadcrumbs} aria-label='Current location'>
          {crumbs.map((crumb, index) => (
            <span className={styles.crumbGroup} key={`${crumb.label}-${index}`}>
              {index > 0 ? (
                <ChevronRight className={styles.crumbSeparator} size={16} aria-hidden='true' />
              ) : null}
              <span className={index === crumbs.length - 1 ? styles.crumbCurrent : styles.crumb}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
        {statusLabel ? (
          <span className={styles.statusBadge}>
            <FilePenLine size={14} aria-hidden='true' />
            {statusLabel}
          </span>
        ) : null}
        {navigationActions ? <div className={styles.navigationActions}>{navigationActions}</div> : null}
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
        {actions}
        {actions ? <span className={styles.divider} aria-hidden='true' /> : null}
        {accountControl ?? (
          <UnstyledButton className={styles.accountButton} type='button' aria-label={accountLabel}>
            <span className={styles.accountAvatar}>
              <IUser size={16} aria-hidden='true' />
            </span>
            <span className={styles.accountLabel}>{accountLabel}</span>
          </UnstyledButton>
        )}
      </div>
    </header>
  )
}
