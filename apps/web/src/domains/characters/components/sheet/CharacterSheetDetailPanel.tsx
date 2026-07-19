import { Text, Title } from '@mantine/core'
import type {
  CharacterSheetDetailPanelProps,
  CharacterSheetDetailRowListProps,
  CharacterSheetDetailRowProps
} from './characterSheetDetailPanel.types'
import * as styles from './characterSheet.css'

export function CharacterSheetDetailPanel({
  ariaId,
  title,
  description,
  headerActions,
  children
}: CharacterSheetDetailPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={ariaId}>
      <div className={styles.panelHeader}>
        <div>
          <Title id={ariaId} className={styles.panelTitle}>{title}</Title>
          <Text className={styles.muted}>{description}</Text>
        </div>
        {headerActions ? <div>{headerActions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function CharacterSheetDetailRowList({ children }: CharacterSheetDetailRowListProps) {
  return <div className={styles.rowList}>{children}</div>
}

export function CharacterSheetDetailRow({ ariaLabel, left, right }: CharacterSheetDetailRowProps) {
  return (
    <div aria-label={ariaLabel} className={styles.row} role={ariaLabel ? 'group' : undefined}>
      <div>{left}</div>
      {right ? right : null}
    </div>
  )
}

export function CharacterSheetCompactActions({ children }: { children: CharacterSheetDetailRowListProps['children'] }) {
  return <div className={styles.compactActions}>{children}</div>
}
