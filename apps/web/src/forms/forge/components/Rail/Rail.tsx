import { Group } from '@mantine/core'
import clsx from 'clsx'
import type { RailProps, Summary } from './Rail.types'
import { RailItem } from '../RailItem/RailItem'
import { StatusMarker } from '../StatusMarker/StatusMarker'
import * as styles from './Rail.css'

export function Rail({
  'aria-label': ariaLabel = 'Authoring structure',
  children,
  className,
  items,
  subtitle = 'Ember Lance',
  summaries,
  title = 'Structure'
}: RailProps) {
  return (
    <aside id='forge-structure-rail' aria-label={ariaLabel} className={clsx(styles.rail, className)}>
      {children ?? (
        <>
          <header className={styles.header}>
            <div className={styles.headerText}>
              <h2 className={styles.title}>{title}</h2>
              <p className={styles.subtitle}>{subtitle}</p>
            </div>
          </header>
          <nav className={styles.tree} aria-label='Authoring steps'>
            {(items ?? []).map((item) => (
              <RailItem key={item.id} item={item} />
            ))}
          </nav>
          {summaries?.length ? (
            <footer className={styles.footer} aria-label='Authoring status'>
              {summaries.map((summary) => (
                <StatusSummary key={summary.label} summary={summary} />
              ))}
            </footer>
          ) : null}
        </>
      )}
    </aside>
  )
}

function StatusSummary({ summary }: { summary: Summary }) {
  return (
    <Group
      className={styles.summaryItem}
      aria-label={`${summary.value} ${summary.label}`}
      gap={4}
      title={`${summary.value} ${summary.label}`}
    >
      <StatusMarker status={summary.status} />
      <span className={styles.summaryValue}>{summary.value}</span>
    </Group>
  )
}
