import { Text } from '@mantine/core'
import { Puzzle } from 'lucide-react'
import { Fragment } from 'react'
import type { EditorHeaderProps } from './EditorHeader.types'
import * as styles from './EditorHeader.css'
import clsx from 'clsx'

export function EditorHeader({ path, tagLabel, title }: EditorHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <nav className={styles.stepTrail} aria-label='Current step path'>
          {path.map((item, index) => {
            const isCurrent = index === path.length - 1

            return (
              <Fragment key={`${item.label}-${index}`}>
                {index > 0 ? <span className={styles.stepTrailSeparator}>/</span> : null}
                <span className={clsx(styles.stepTrailItem, { ['current']: isCurrent })}>
                  {item.label}
                </span>
              </Fragment>
            )
          })}
        </nav>
        <div className={styles.titleRow}>
          <Text component='h1' className={styles.title}>
            {title}
          </Text>
          <span className={styles.mechanicTag}>
            <Puzzle aria-hidden='true' size={13} />
            <span>{tagLabel}</span>
          </span>
        </div>
      </div>

      <hr className={styles.divider} />
    </header>
  )
}
