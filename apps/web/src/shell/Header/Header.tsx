import { TextInput, UnstyledButton } from '@mantine/core'
import { Search } from 'lucide-react'
import ILogo from '#assets/icons/ILogo'
import IUser from '#assets/icons/IUser'
import type { HeaderProps } from './Header.types'
import * as styles from './Header.css'

export function Header({
  accountControl,
  accountLabel = 'Account',
  actions,
  mobileActions,
  navigationActions,
  supplement
}: HeaderProps) {
  return (
    <header className={styles.root}>
      <div className={styles.leftCluster}>
        <div className={styles.brand}>
          <ILogo className={styles.logo} size={36} aria-hidden='true' />
          <span className={styles.brandName}>Artificer Toolkit</span>
        </div>
        {supplement}
      </div>
      {navigationActions ? <div className={styles.navigationActions}>{navigationActions}</div> : null}
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
      {mobileActions ? <div className={styles.mobileActionCluster}>{mobileActions}</div> : null}
    </header>
  )
}
