import { ActionIcon, Group } from '@mantine/core'
import clsx from 'clsx'
import { X } from 'lucide-react'
import type { RailProps, StructureRailProps, Summary } from './Rail.types'
import { RailItem } from '../RailItem/RailItem'
import { StatusMarker } from '../StatusMarker/StatusMarker'
import * as styles from './Rail.css'

export function Rail({
  'aria-label': ariaLabel = 'Authoring workspace navigation',
  children,
  className,
  items,
  subtitle = 'Ember Lance',
  summaries,
  title = 'Structure'
}: RailProps) {
  return (
    <aside
      id='forge-structure-rail'
      aria-label={ariaLabel}
      className={clsx(styles.rail, className)}
    >
      <header className={styles.structureHeader}>
        <RailSectionLabel title={title} subtitle={subtitle} />
      </header>
      {children ?? <StructureRailContent items={items} summaries={summaries} />}
    </aside>
  )
}

export function StructureRail({
  'aria-label': ariaLabel = 'Authoring structure',
  children,
  className,
  items,
  onClose,
  subtitle = 'Ember Lance',
  summaries,
  title = 'Structure'
}: StructureRailProps) {
  return (
    <aside
      id='forge-structure-rail'
      aria-label={ariaLabel}
      className={clsx(styles.rail, className)}
    >
      <header className={styles.structureHeader}>
        <RailSectionLabel title={title} subtitle={subtitle} />
        {onClose ? (
          <ActionIcon
            className={styles.structureCloseButton}
            type='button'
            aria-label='Close structure sidebar'
            variant='transparent'
            onClick={onClose}
          >
            <X size={16} />
          </ActionIcon>
        ) : null}
      </header>
      {children ?? <StructureRailContent items={items} summaries={summaries} />}
    </aside>
  )
}

function StructureRailContent({
  items,
  summaries
}: Pick<StructureRailProps, 'items' | 'summaries'>) {
  const editorItems = (items ?? []).map((item) => <RailItem key={item.id} item={item} />)

  return (
    <div className={styles.structurePanel}>
      <nav className={styles.tree} aria-label='Authoring steps'>
        {editorItems}
      </nav>
      {summaries?.length ? (
        <footer className={styles.footer} aria-label='Authoring status'>
          {summaries.map((summary) => (
            <StatusSummary key={summary.label} summary={summary} />
          ))}
        </footer>
      ) : null}
    </div>
  )
}

function RailSectionLabel({ title, subtitle }: { subtitle: string; title: string }) {
  return (
    <span className={styles.sectionLabel}>
      <span className={styles.sectionTitle}>{title}</span>
      <span className={styles.sectionSubtitle}>{subtitle}</span>
    </span>
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
