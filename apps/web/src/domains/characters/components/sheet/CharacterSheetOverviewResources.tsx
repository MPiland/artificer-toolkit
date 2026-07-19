import { Text, Title } from '@mantine/core'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetOverviewResources({
  sheet
}: CharacterSheetSectionProps) {
  return (
    <section className={styles.playPanel} aria-labelledby='character-sheet-resource-summary'>
      <div className={styles.overviewPanelHeader}>
        <div>
          <Title id='character-sheet-resource-summary' className={styles.panelTitle}>Resources</Title>
        </div>
      </div>
      <div className={styles.resourceOverviewGrid}>
        {sheet.resources.items.length
          ? sheet.resources.items.map((resource) => (
              <div className={styles.resourceOverviewItem} key={resource.id}>
                <Text className={styles.proficiencyName}>{resource.label}</Text>
                <Text className={styles.metricValue}>
                  {resource.remaining}
                  {' '}
                  /
                  {' '}
                  {resource.max}
                </Text>
                <Text className={styles.proficiencyMeta}>Uses</Text>
              </div>
            ))
          : <Text className={styles.muted}>No limited resources are currently available.</Text>}
        {sheet.spells.slots.slice(0, 2).map((slot) => (
          <div className={styles.resourceOverviewItem} key={slot.slotKey}>
            <Text className={styles.proficiencyName}>{slot.label}</Text>
            <Text className={styles.metricValue}>
              {slot.remaining}
              {' '}
              /
              {' '}
              {slot.max}
            </Text>
            <Text className={styles.proficiencyMeta}>Slots</Text>
          </div>
        ))}
      </div>
    </section>
  )
}
