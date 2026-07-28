import { Drawer, Text } from '@mantine/core'
import { useState } from 'react'
import IInspiration from '#assets/icons/IInspiration'
import * as styles from './characterSheet.css'
import { CharacterSheetOverviewStatusStrip } from './CharacterSheetOverviewStatusStrip'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetMobileStatusBar({
  openPanel,
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const conditions = sheet.overview.conditions
  const activeConditionSummary = conditions.length
    ? conditions.map((condition) => condition.label).join(', ')
    : 'None'
  const conditionSummary =
    sheet.overview.exhaustion.level > 0
      ? `${activeConditionSummary} · Exhaustion ${sheet.overview.exhaustion.level}`
      : activeConditionSummary
  const defenseSummary = sheet.reference.defenses.length
    ? `${sheet.reference.defenses.length} active`
    : 'None'

  return (
    <>
      <section className={styles.mobileStatusBar} aria-label='Current character status'>
        <button
          aria-label='Manage defenses'
          className={styles.mobileStatusAction}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'DEFENSES' })}
        >
          <Text className={styles.metricLabel}>Defenses</Text>
          <Text className={styles.mobileStatusValue}>{defenseSummary}</Text>
        </button>
        <button
          aria-label='Manage conditions and exhaustion'
          className={styles.mobileStatusAction}
          type='button'
          onClick={() => setConditionsOpen(true)}
        >
          <Text className={styles.metricLabel}>Conditions</Text>
          <Text className={styles.mobileStatusValue} truncate>
            {conditionSummary}
          </Text>
        </button>
        <div className={styles.mobileStatusItem}>
          <Text className={styles.metricLabel}>Inspiration</Text>
          <button
            aria-label={sheet.overview.inspiration ? 'Use inspiration' : 'Gain inspiration'}
            aria-pressed={sheet.overview.inspiration ?? false}
            className={styles.mobileInspirationButton}
            data-active={sheet.overview.inspiration ?? false}
            disabled={pending}
            type='button'
            onClick={() =>
              submitCommand({
                type: 'SET_INSPIRATION',
                inspired: !(sheet.overview.inspiration ?? false),
                expectedVersion: sheet.meta.streamVersion
              })
            }
          >
            <IInspiration aria-hidden='true' />
            <span>{sheet.overview.inspiration ? 'Ready' : 'Empty'}</span>
          </button>
        </div>
      </section>

      <Drawer
        opened={conditionsOpen}
        position='bottom'
        size='auto'
        title='Conditions & Exhaustion'
        onClose={() => setConditionsOpen(false)}
      >
        <CharacterSheetOverviewStatusStrip
          conditionsOnly
          pending={pending}
          sheet={sheet}
          submitCommand={submitCommand}
        />
      </Drawer>
    </>
  )
}
