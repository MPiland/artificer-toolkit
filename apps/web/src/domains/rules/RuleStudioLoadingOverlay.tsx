import { Loader } from '@mantine/core'
import clsx from 'clsx'
import * as styles from './RuleStudioLoadingOverlay.css'

export function RuleStudioLoadingOverlay({
  contained = false,
  label
}: {
  contained?: boolean
  label: string
}) {
  return (
    <div
      className={clsx(styles.overlay, contained ? styles.contained : styles.viewport)}
      aria-busy='true'
    >
      <div className={styles.panel} role='status' aria-live='polite'>
        <Loader size='lg' aria-hidden='true' />
        <p className={styles.copy}>{label}</p>
      </div>
    </div>
  )
}
