import { Group } from '@mantine/core'
import * as styles from './StatusSummary.css'
import clsx from 'clsx'
import { statusLabel, statusIcon } from '../Steps.utils'
import type { SummaryProps } from './StatusSummary.types'

export function StatusSummary({ summary }: { summary: SummaryProps }) {
  const label = summary.markerLabel ?? statusLabel(summary.status)

  return (
    <Group
      className={styles.summaryItem}
      aria-label={`${summary.value} ${summary.label}`}
      gap={4}
      title={`${summary.value} ${summary.label}`}
    >
      <span
        className={clsx(styles.statusMarker, styles.statusClass[summary.status])}
        aria-label={label}
        title={label}
      >
        {statusIcon(summary.status)}
      </span>
      <span className={styles.summaryValue}>{summary.value}</span>
    </Group>
  )
}
