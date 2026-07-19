import { Text, Title } from '@mantine/core'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'
import { formatSigned } from './characterSheet.utils'
import { formatProficiencyLevel, getAbilityShortLabel } from './characterSheetOverview.utils'

export function CharacterSheetOverviewProficiencies({
  abilities,
  savingThrows,
  skills
}: {
  abilities: CharacterSheet['overview']['abilities']
  savingThrows: CharacterSheet['overview']['savingThrows']
  skills: CharacterSheet['overview']['skills']
}) {
  return (
    <div className={styles.proficiencyPanelGrid}>
      <CharacterSheetSavingThrowsPanel savingThrows={savingThrows} />
      <CharacterSheetSkillsPanel abilities={abilities} skills={skills} />
    </div>
  )
}

export function CharacterSheetSavingThrowsPanel({
  savingThrows
}: {
  savingThrows: CharacterSheet['overview']['savingThrows']
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
          <div className={styles.proficiencyRow} key={save.ability}>
            <span
              className={styles.proficiencyDot}
              data-proficiency={save.proficiency}
              aria-label={formatProficiencyLevel(save.proficiency)}
            />
            <Text className={styles.proficiencyName}>{save.label}</Text>
            <Text className={styles.proficiencyTotal}>{formatSigned(save.total)}</Text>
          </div>
        ))}
      </div>
    </section>
  )
}

export function CharacterSheetSkillsPanel({
  abilities = [],
  skills
}: {
  abilities?: CharacterSheet['overview']['abilities']
  skills: CharacterSheet['overview']['skills']
}) {
  const abilityModifiers = new Map(abilities.map((ability) => [ability.ability, ability.modifier]))

  return (
    <section className={styles.proficiencyPanel} aria-labelledby='character-sheet-skills'>
      <div className={styles.overviewPanelHeader}>
        <div>
          <Title id='character-sheet-skills' className={styles.panelTitle}>Skills</Title>
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
          <div className={styles.skillRow} key={skill.code}>
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
          </div>
        ))}
      </div>
    </section>
  )
}
