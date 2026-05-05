import { Badge, Text, Title } from '@mantine/core'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'

export function CharacterSheetActions({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section className={styles.panel} aria-labelledby='character-sheet-actions'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-actions' className={styles.panelTitle}>Actions</Title>
          <Text className={styles.muted}>Roll buttons are reserved for the dice tranche; action references are available now.</Text>
        </div>
      </div>
      <div className={styles.rowList}>
        {sheet.actions.items.length
          ? sheet.actions.items.map((action) => (
              <div className={styles.row} key={action.id}>
                <div>
                  <Text fw={700}>{action.label}</Text>
                  <Text className={styles.muted}>{action.sourceLabel ?? 'Character'}</Text>
                  {action.description ? <AuthoredDetailProse html={action.description} fallback='' /> : null}
                </div>
                <Badge variant='light'>{action.kind.replace(/_/g, ' ')}</Badge>
              </div>
            ))
          : <Text className={styles.muted}>No action references are currently available.</Text>}
      </div>
    </section>
  )
}
