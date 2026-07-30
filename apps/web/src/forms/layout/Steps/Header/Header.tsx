import { CloseButton } from '@mantine/core'
import { useAuthoringLayout } from '../../AuthoringLayoutContext'
import * as styles from './Header.css'
import { Rail } from '#ui'

export function Header() {
  const { isWideDesktop, toggleStepsNavigation } = useAuthoringLayout()

  return (
    <Rail.Header className={styles.header}>
      <span className={styles.sectionLabel}>
        <span className={styles.sectionTitle}>Structure</span>
      </span>
      <span className={styles.headerActions}>
        {!isWideDesktop ? (
          <CloseButton
            aria-label='Close steps'
            className={styles.closeButton}
            onClick={toggleStepsNavigation}
          />
        ) : null}
      </span>
    </Rail.Header>
  )
}
