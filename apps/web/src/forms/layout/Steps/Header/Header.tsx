import { CloseButton } from '@mantine/core'
import { useAuthoringLayout } from '../../AuthoringLayoutContext'
import * as styles from './Header.css'
import { Rail } from '#ui'

export function Header() {
  const { toggleStepsNavigation } = useAuthoringLayout()

  return (
    <Rail.Header className={styles.header}>
      <span className={styles.sectionLabel}>
        <span className={styles.sectionTitle}>Steps</span>
      </span>
      <span className={styles.headerActions}>
        <CloseButton
          aria-label='Close steps'
          className={styles.closeButton}
          onClick={toggleStepsNavigation}
        />
      </span>
    </Rail.Header>
  )
}
