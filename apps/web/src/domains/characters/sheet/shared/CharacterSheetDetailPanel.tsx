import { Text, Title } from '@mantine/core'
import type {
  CharacterSheetDetailPanelProps,
  CharacterSheetDetailRowListProps,
  CharacterSheetDetailRowProps
} from './characterSheetDetailPanel.types'
import * as panelStyles from './panel.css'
import * as rowStyles from './rows.css'

export function CharacterSheetDetailPanel({
  ariaId,
  title,
  description,
  headerActions,
  hideTitle,
  children
}: CharacterSheetDetailPanelProps) {
  return (
    <section
      aria-label={hideTitle ? title : undefined}
      aria-labelledby={hideTitle ? undefined : ariaId}
      className={panelStyles.panel}
    >
      <div className={panelStyles.panelHeader}>
        <div>
          {hideTitle ? null : (
            <Title id={ariaId} className={panelStyles.panelTitle}>
              {title}
            </Title>
          )}
          {description ? <Text className={panelStyles.muted}>{description}</Text> : null}
        </div>
        {headerActions ? <div>{headerActions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function CharacterSheetDetailRowList({ children }: CharacterSheetDetailRowListProps) {
  return <div className={rowStyles.rowList}>{children}</div>
}

export function CharacterSheetDetailRow({ ariaLabel, left, right }: CharacterSheetDetailRowProps) {
  return (
    <div aria-label={ariaLabel} className={rowStyles.row} role={ariaLabel ? 'group' : undefined}>
      <div>{left}</div>
      {right ? right : null}
    </div>
  )
}

export function CharacterSheetCompactActions({
  children
}: {
  children: CharacterSheetDetailRowListProps['children']
}) {
  return <div className={rowStyles.compactActions}>{children}</div>
}
