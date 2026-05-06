import { Badge, Text, Title } from '@mantine/core'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'

function ReferenceFactRows({
  badge,
  empty,
  items
}: {
  badge: string
  empty: string
  items: CharacterSheet['reference']['proficiencies']
}) {
  if (!items.length) return <Text className={styles.muted}>{empty}</Text>

  return (
    <>
      {items.map((item) => (
        <div className={styles.row} key={`${badge}:${item.label}:${item.value}`}>
          <div>
            <Text fw={700}>{item.label}</Text>
            <Text className={styles.muted}>{item.value}</Text>
          </div>
          <Badge variant='light'>{badge}</Badge>
        </div>
      ))}
    </>
  )
}

export function CharacterSheetReference({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section className={styles.panel} aria-labelledby='character-sheet-reference'>
      <div className={styles.panelHeader}>
        <div>
          <Title id='character-sheet-reference' className={styles.panelTitle}>Reference</Title>
          <Text className={styles.muted}>Features, traits, and quick table context.</Text>
        </div>
      </div>
      <div className={styles.rowList}>
        {sheet.reference.features.length
          ? sheet.reference.features.map((feature) => (
              <div className={styles.row} key={`${feature.sourceLabel}:${feature.id}`}>
                <div>
                  <Text fw={700}>{feature.label}</Text>
                  <Text className={styles.muted}>{feature.sourceLabel}</Text>
                  {feature.description ? <AuthoredDetailProse html={feature.description} fallback='' /> : null}
                </div>
                <Badge variant='light'>Feature</Badge>
              </div>
            ))
          : <Text className={styles.muted}>No feature references are currently available.</Text>}
        <ReferenceFactRows
          badge='Proficiency'
          empty='No proficiencies are currently available.'
          items={sheet.reference.proficiencies}
        />
        <ReferenceFactRows
          badge='Defense'
          empty='No defenses are currently available.'
          items={sheet.reference.defenses}
        />
        <ReferenceFactRows
          badge='Sense'
          empty='No senses are currently available.'
          items={sheet.reference.senses}
        />
      </div>
    </section>
  )
}
