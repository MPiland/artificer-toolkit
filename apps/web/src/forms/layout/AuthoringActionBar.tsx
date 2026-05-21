import type { ReactNode } from 'react'
import clsx from 'clsx'
import * as styles from './AuthoringActionBar.css'

type AuthoringActionBarProps = {
  center?: ReactNode
  end?: ReactNode
  padding?: 'flush' | 'padded'
  start?: ReactNode
  surface?: 'canvas' | 'header'
}

export function AuthoringActionBar({
  center,
  end,
  padding = 'flush',
  start,
  surface = 'canvas'
}: AuthoringActionBarProps) {
  return (
    <footer
      className={clsx(
        styles.root,
        padding === 'padded' ? styles.padded : styles.flush,
        surface === 'header' ? styles.headerSurface : styles.canvasSurface
      )}
      data-testid='authoring-action-bar'
    >
      <div className={styles.inner}>
        <div className={styles.start}>{start}</div>
        <div className={styles.center}>{center}</div>
        <div className={styles.end}>{end}</div>
      </div>
    </footer>
  )
}
