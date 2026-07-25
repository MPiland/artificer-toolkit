import { Text, Title } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import * as styles from './characterSheet.css'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import type { CharacterSheet } from './CharacterSheet.types'
import { formatSigned } from './characterSheet.utils'
import { formatProficiencyLevel, getAbilityShortLabel } from './characterSheetOverview.utils'

export function CharacterSheetOverviewProficiencies({
  abilities,
  savingThrows,
  skills,
  openPanel
}: {
  abilities: CharacterSheet['overview']['abilities']
  savingThrows: CharacterSheet['overview']['savingThrows']
  skills: CharacterSheet['overview']['skills']
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  return (
    <div className={styles.proficiencyPanelGrid}>
      <CharacterSheetSavingThrowsPanel openPanel={openPanel} savingThrows={savingThrows} />
      <CharacterSheetSkillsPanel abilities={abilities} openPanel={openPanel} skills={skills} />
    </div>
  )
}

export function CharacterSheetSavingThrowsPanel({
  savingThrows,
  openPanel
}: {
  savingThrows: CharacterSheet['overview']['savingThrows']
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  return (
    <section className={styles.proficiencyPanel} aria-labelledby='character-sheet-saving-throws'>
      <div className={styles.overviewPanelHeader}>
        <div>
          <Title id='character-sheet-saving-throws' className={styles.panelTitle}>Saving Throws</Title>
          <Text className={styles.muted}>Ability defenses and proficiency.</Text>
        </div>
      </div>
      <div className={styles.proficiencyList}>
        {savingThrows.map((save) => (
          <button
            className={clsx(styles.proficiencyRow, styles.sheetInspectorTrigger)}
            disabled={!openPanel}
            key={save.ability}
            type='button'
            onClick={() => openPanel?.({ kind: 'SAVING_THROW', ability: save.ability })}
          >
            <span
              className={styles.proficiencyDot}
              data-proficiency={save.proficiency}
              aria-label={formatProficiencyLevel(save.proficiency)}
            />
            <Text className={styles.proficiencyName}>{save.label}</Text>
            <Text className={styles.proficiencyTotal}>{formatSigned(save.total)}</Text>
          </button>
        ))}
      </div>
    </section>
  )
}

export function CharacterSheetSkillsPanel({
  abilities = [],
  skills,
  openPanel
}: {
  abilities?: CharacterSheet['overview']['abilities']
  skills: CharacterSheet['overview']['skills']
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  const abilityModifiers = new Map(abilities.map((ability) => [ability.ability, ability.modifier]))

  return (
    <section className={styles.proficiencyPanel} aria-labelledby='character-sheet-skills'>
      <div className={styles.overviewPanelHeader}>
        <div>
          <button
            className={styles.panelHeadingTrigger}
            disabled={!openPanel}
            type='button'
            onClick={() => openPanel?.({ kind: 'SKILLS' })}
          >
            <Title id='character-sheet-skills' className={styles.panelTitle}>Skills</Title>
            <ChevronRight aria-hidden='true' size={16} />
          </button>
        </div>
      </div>
      <div className={styles.proficiencyList}>
        <div className={styles.skillTableHeader}>
          <span aria-hidden='true' />
          <Text>Skill</Text>
          <Text>Abil.</Text>
          <Text>Prof.</Text>
          <Text>Mod.</Text>
          <Text>Total</Text>
        </div>
        {skills.map((skill) => (
          <button
            className={clsx(styles.skillRow, styles.sheetInspectorTrigger)}
            disabled={!openPanel}
            key={skill.code}
            type='button'
            onClick={() => openPanel?.({ kind: 'SKILL', skillId: skill.skillId })}
          >
            <span
              className={styles.proficiencyDot}
              data-proficiency={skill.proficiency}
              aria-label={formatProficiencyLevel(skill.proficiency)}
            />
            <div>
              <Text className={styles.proficiencyName}>{skill.label}</Text>
            </div>
            <Text className={styles.proficiencyMeta}>{getAbilityShortLabel(skill.ability)}</Text>
            <span
              className={styles.proficiencyDot}
              data-proficiency={skill.proficiency}
              aria-label={formatProficiencyLevel(skill.proficiency)}
            />
            <Text className={styles.proficiencyMeta}>{formatSigned(abilityModifiers.get(skill.ability) ?? 0)}</Text>
            <Text className={styles.proficiencyTotal}>{formatSigned(skill.total)}</Text>
          </button>
        ))}
      </div>
    </section>
  )
}
