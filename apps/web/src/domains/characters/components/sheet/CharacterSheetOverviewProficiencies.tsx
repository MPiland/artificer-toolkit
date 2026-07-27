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
    <section
      className={`${styles.proficiencyPanel} ${styles.savingThrowsPanel}`}
      aria-labelledby='character-sheet-saving-throws'
    >
      <div className={styles.overviewPanelHeader}>
        <div>
          <Title id='character-sheet-saving-throws' className={styles.panelTitle}>
            Saving Throws
          </Title>
        </div>
      </div>
      <div className={`${styles.proficiencyList} ${styles.savingThrowsList}`}>
        {savingThrows.map((save) => (
          <button
            aria-label={`Inspect ${save.label} saving throw. ${formatProficiencyLevel(
              save.proficiency
            )}. Total ${formatSigned(save.total)}.`}
            className={clsx(styles.savingThrowCard, styles.sheetInspectorTrigger)}
            disabled={!openPanel}
            key={save.ability}
            type='button'
            onClick={() => openPanel?.({ kind: 'SAVING_THROW', ability: save.ability })}
          >
            <div className={styles.savingThrowCardHeader}>
              <span className={styles.savingThrowMarkerSpacer} aria-hidden='true' />
              <Text className={styles.savingThrowCardLabel}>
                {getAbilityShortLabel(save.ability)}
              </Text>
              <span
                className={styles.proficiencyDot}
                data-proficiency={save.proficiency}
                aria-hidden='true'
              />
            </div>
            <Text className={styles.savingThrowCardValue}>{formatSigned(save.total)}</Text>
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
    <section
      className={`${styles.proficiencyPanel} ${styles.skillsPanel}`}
      aria-labelledby='character-sheet-skills'
    >
      <div className={styles.overviewPanelHeader}>
        <div>
          <button
            className={styles.panelHeadingTrigger}
            disabled={!openPanel}
            type='button'
            onClick={() => openPanel?.({ kind: 'SKILLS' })}
          >
            <Title id='character-sheet-skills' className={styles.panelTitle}>
              Skills
            </Title>
            <ChevronRight aria-hidden='true' size={16} />
          </button>
        </div>
      </div>
      <div className={`${styles.proficiencyList} ${styles.skillsList}`}>
        <div className={styles.skillTableHeader}>
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
            <div>
              <Text className={styles.proficiencyName}>{skill.label}</Text>
            </div>
            <Text className={styles.proficiencyMeta}>{getAbilityShortLabel(skill.ability)}</Text>
            <span
              className={styles.proficiencyDot}
              data-proficiency={skill.proficiency}
              aria-label={formatProficiencyLevel(skill.proficiency)}
              role='img'
            />
            <Text className={styles.proficiencyMeta}>
              {formatSigned(abilityModifiers.get(skill.ability) ?? 0)}
            </Text>
            <Text className={styles.proficiencyTotal}>{formatSigned(skill.total)}</Text>
          </button>
        ))}
      </div>
    </section>
  )
}
