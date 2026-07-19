import { Text } from '@mantine/core'
import * as styles from './characterSheet.css'
import { CharacterSheetOverviewPlayArea } from './CharacterSheetOverviewPlayArea'
import {
  CharacterSheetSavingThrowsPanel,
  CharacterSheetSkillsPanel
} from './CharacterSheetOverviewProficiencies'
import { CharacterSheetOverviewResources } from './CharacterSheetOverviewResources'
import type { CharacterSheet, CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetSensesPanel({ sheet }: { sheet: CharacterSheet }) {
  const passiveFacts = sheet.overview.facts.filter((fact) => fact.label.toLowerCase().startsWith('passive'))
  const senses = sheet.reference.senses

  return (
    <section className={styles.overviewPanel} aria-labelledby='character-sheet-senses'>
      <div className={styles.overviewPanelHeader}>
        <Text id='character-sheet-senses' className={styles.proficiencyHeading}>Senses</Text>
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
        {!passiveFacts.length && !senses.length ? <Text className={styles.muted}>No senses are currently available.</Text> : null}
      </div>
    </section>
  )
}

export function CharacterSheetDefensesPanel({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section className={styles.overviewPanel} aria-labelledby='character-sheet-defenses'>
      <div className={styles.overviewPanelHeader}>
        <Text id='character-sheet-defenses' className={styles.proficiencyHeading}>Defenses</Text>
      </div>
      <div className={styles.compactDataList}>
        {sheet.reference.defenses.map((defense) => (
          <div className={styles.compactDataRow} key={`${defense.kind}:${defense.damageTypeId}`}>
            <Text>{defense.label}</Text>
            <Text fw={800}>{defense.value}</Text>
          </div>
        ))}
        {!sheet.reference.defenses.length ? <Text className={styles.muted}>No resistances, immunities, or vulnerabilities.</Text> : null}
      </div>
    </section>
  )
}

function CharacterSheetProficiencySummary({ sheet }: { sheet: CharacterSheet }) {
  return (
    <section className={styles.overviewPanel} aria-labelledby='character-sheet-proficiency-summary'>
      <div className={styles.overviewPanelHeader}>
        <Text id='character-sheet-proficiency-summary' className={styles.proficiencyHeading}>Proficiencies</Text>
      </div>
      <div className={styles.compactDataList}>
        {sheet.reference.proficiencies.slice(0, 5).map((proficiency) => (
          <div className={styles.compactDataRow} key={`${proficiency.label}:${proficiency.value}`}>
            <Text>{proficiency.label}</Text>
            <Text>{proficiency.value}</Text>
          </div>
        ))}
        {!sheet.reference.proficiencies.length ? <Text className={styles.muted}>No proficiencies are currently available.</Text> : null}
      </div>
    </section>
  )
}

export function CharacterSheetOverview({
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps) {
  return (
    <section className={styles.overviewLayout} aria-labelledby='character-sheet-overview'>
      <h2 id='character-sheet-overview' className={styles.visuallyHidden}>Overview</h2>
      <div className={styles.playSheetGrid}>
        <div className={styles.overviewLeftRail}>
          <CharacterSheetSavingThrowsPanel savingThrows={sheet.overview.savingThrows} />
          <CharacterSheetSensesPanel sheet={sheet} />
          <CharacterSheetDefensesPanel sheet={sheet} />
          <CharacterSheetProficiencySummary sheet={sheet} />
        </div>
        <CharacterSheetSkillsPanel abilities={sheet.overview.abilities} skills={sheet.overview.skills} />
        <div className={styles.playAreaStack}>
          <CharacterSheetOverviewPlayArea sheet={sheet} />
          <CharacterSheetOverviewResources
            pending={pending}
            sheet={sheet}
            submitCommand={submitCommand}
          />
        </div>
      </div>
    </section>
  )
}
