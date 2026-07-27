import { Badge, Text } from '@mantine/core'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import {
  CharacterSheetDetailPanel,
  CharacterSheetDetailRow,
  CharacterSheetDetailRowList
} from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'

function ReferenceFactRows({
  badge,
  empty,
  items
}: {
  badge: string
  empty: string
  items: readonly { label: string; value: string }[]
}) {
  if (!items.length) return <Text className={styles.muted}>{empty}</Text>

  return (
    <>
      {items.map((item) => (
        <CharacterSheetDetailRow
          key={`${badge}:${item.label}:${item.value}`}
          left={
            <>
              <Text fw={700}>{item.label}</Text>
              <Text className={styles.muted}>{item.value}</Text>
            </>
          }
          right={<Badge variant='light'>{badge}</Badge>}
        />
      ))}
    </>
  )
}

export function CharacterSheetReference({
  mode = 'all',
  sheet
}: {
  mode?: 'all' | 'features' | 'proficiencies'
  sheet: CharacterSheet
}) {
  const showFeatures = mode !== 'proficiencies'
  const showProficiencies = mode !== 'features'
  const title =
    mode === 'features' ? 'Features' : mode === 'proficiencies' ? 'Proficiencies' : 'Reference'

  return (
    <CharacterSheetDetailPanel ariaId={`character-sheet-${mode}`} title={title}>
      <CharacterSheetDetailRowList>
        {showFeatures && sheet.reference.features.length ? (
          sheet.reference.features.map((feature) => (
            <CharacterSheetDetailRow
              key={`${feature.sourceLabel}:${feature.id}`}
              left={
                <>
                  <Text fw={700}>{feature.label}</Text>
                  <Text className={styles.muted}>{feature.sourceLabel}</Text>
                  {feature.description ? (
                    <AuthoredDetailProse html={feature.description} fallback='' />
                  ) : null}
                </>
              }
              right={<Badge variant='light'>Feature</Badge>}
            />
          ))
        ) : showFeatures ? (
          <Text className={styles.muted}>No feature references are currently available.</Text>
        ) : null}
        {showProficiencies ? (
          <ReferenceFactRows
            badge='Proficiency'
            empty='No proficiencies are currently available.'
            items={sheet.reference.proficiencies}
          />
        ) : null}
        {mode === 'all' ? (
          <ReferenceFactRows
            badge='Defense'
            empty='No defenses are currently available.'
            items={sheet.reference.defenses}
          />
        ) : null}
        {mode === 'all' ? (
          <ReferenceFactRows
            badge='Sense'
            empty='No senses are currently available.'
            items={sheet.reference.senses}
          />
        ) : null}
      </CharacterSheetDetailRowList>
    </CharacterSheetDetailPanel>
  )
}
