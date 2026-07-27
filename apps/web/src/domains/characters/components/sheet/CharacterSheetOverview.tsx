import { Text } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import * as styles from './characterSheet.css'
import { CharacterSheetOverviewPlayArea } from './CharacterSheetOverviewPlayArea'
import {
  CharacterSheetSavingThrowsPanel,
  CharacterSheetSkillsPanel
} from './CharacterSheetOverviewProficiencies'
import { formatProficiencySummaryLabel } from './characterSheetOverview.utils'
import type { CharacterSheet, CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetSensesPanel({
  sheet,
  openPanel
}: {
  sheet: CharacterSheet
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  const passiveFacts = sheet.overview.facts.filter((fact) =>
    fact.label.toLowerCase().startsWith('passive')
  )
  const senses = sheet.reference.senses

  return (
    <section className={styles.overviewPanel} aria-labelledby='character-sheet-senses'>
      <div className={styles.overviewPanelHeader}>
        <button
          className={styles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'SENSES' })}
        >
          <Text id='character-sheet-senses' className={styles.proficiencyHeading}>
            Senses
          </Text>
          <ChevronRight aria-hidden='true' size={16} />
        </button>
      </div>
      <div className={styles.compactDataList}>
        {passiveFacts.map((fact) => (
          <div className={styles.compactDataRow} key={fact.label}>
            <Text>{fact.label}</Text>
            <Text fw={800}>{fact.value}</Text>
          </div>
        ))}
        {senses.map((sense) => (
          <div className={styles.compactDataRow} key={sense.label}>
            <Text>{sense.label}</Text>
            <Text fw={800}>{sense.value}</Text>
          </div>
        ))}
        {!passiveFacts.length && !senses.length ? (
          <Text className={styles.muted}>No senses are currently available.</Text>
        ) : null}
      </div>
    </section>
  )
}

export function CharacterSheetDefensesPanel({
  sheet,
  openPanel
}: {
  sheet: CharacterSheet
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  return (
    <section className={styles.overviewPanel} aria-labelledby='character-sheet-defenses'>
      <div className={styles.overviewPanelHeader}>
        <button
          className={styles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'DEFENSES' })}
        >
          <Text id='character-sheet-defenses' className={styles.proficiencyHeading}>
            Defenses
          </Text>
          <ChevronRight aria-hidden='true' size={16} />
        </button>
      </div>
      <div className={styles.compactDataList}>
        {sheet.reference.defenses.map((defense) => (
          <div className={styles.compactDataRow} key={`${defense.kind}:${defense.damageTypeId}`}>
            <Text>{defense.label}</Text>
            <Text fw={800}>{defense.value}</Text>
          </div>
        ))}
        {!sheet.reference.defenses.length ? (
          <Text className={styles.muted}>No resistances, immunities, or vulnerabilities.</Text>
        ) : null}
      </div>
    </section>
  )
}

export function CharacterSheetProficiencySummary({
  sheet,
  openPanel
}: {
  sheet: CharacterSheet
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  const groups = [
    { kind: 'ARMOR', label: 'Armor' },
    { kind: 'WEAPON', label: 'Weapons' },
    { kind: 'TOOL', label: 'Tools' },
    { kind: 'LANGUAGE', label: 'Languages' }
  ] as const
  const populatedGroups = groups
    .map((group) => ({
      ...group,
      items: sheet.reference.proficiencies.filter((proficiency) => proficiency.kind === group.kind)
    }))
    .filter((group) => group.items.length)

  return (
    <section
      className={`${styles.overviewPanel} ${styles.proficiencySummaryPanel}`}
      aria-labelledby='character-sheet-proficiency-summary'
    >
      <div className={styles.overviewPanelHeader}>
        <button
          className={styles.panelHeadingTrigger}
          disabled={!openPanel}
          type='button'
          onClick={() => openPanel?.({ kind: 'PROFICIENCIES' })}
        >
          <Text id='character-sheet-proficiency-summary' className={styles.proficiencyHeading}>
            Proficiencies
          </Text>
          <ChevronRight aria-hidden='true' size={16} />
        </button>
      </div>
      <div className={styles.proficiencySummaryList}>
        {populatedGroups.map((group) => (
          <div className={styles.proficiencySummaryGroup} key={group.kind}>
            <Text className={styles.metricLabel}>{group.label}</Text>
            <Text className={styles.proficiencySummaryValues}>
              {group.items.map(formatProficiencySummaryLabel).join(', ')}
            </Text>
          </div>
        ))}
        {!populatedGroups.length ? (
          <Text className={styles.muted}>No proficiencies are currently available.</Text>
        ) : null}
      </div>
    </section>
  )
}

export function CharacterSheetOverviewFacts({ openPanel, sheet }: CharacterSheetSectionProps) {
  return (
    <section className={styles.tabletOverviewGrid} aria-label='Overview facts'>
      <CharacterSheetSavingThrowsPanel
        openPanel={openPanel}
        savingThrows={sheet.overview.savingThrows}
      />
      <CharacterSheetSensesPanel openPanel={openPanel} sheet={sheet} />
      <CharacterSheetDefensesPanel openPanel={openPanel} sheet={sheet} />
      <CharacterSheetProficiencySummary openPanel={openPanel} sheet={sheet} />
    </section>
  )
}

export function CharacterSheetOverview({
  openPanel,
  sheet,
  showDefenses = true
}: CharacterSheetSectionProps & { showDefenses?: boolean }) {
  return (
    <section className={styles.overviewLayout} aria-labelledby='character-sheet-overview'>
      <h2 id='character-sheet-overview' className={styles.visuallyHidden}>
        Overview
      </h2>
      <div className={styles.playSheetGrid}>
        <div className={styles.overviewLeftRail}>
          <CharacterSheetSavingThrowsPanel
            openPanel={openPanel}
            savingThrows={sheet.overview.savingThrows}
          />
          <CharacterSheetSensesPanel openPanel={openPanel} sheet={sheet} />
          {showDefenses ? (
            <CharacterSheetDefensesPanel openPanel={openPanel} sheet={sheet} />
          ) : null}
          <CharacterSheetProficiencySummary openPanel={openPanel} sheet={sheet} />
        </div>
        <CharacterSheetSkillsPanel
          abilities={sheet.overview.abilities}
          openPanel={openPanel}
          skills={sheet.overview.skills}
        />
        <div className={styles.playAreaStack}>
          <CharacterSheetOverviewPlayArea sheet={sheet} />
        </div>
      </div>
    </section>
  )
}
