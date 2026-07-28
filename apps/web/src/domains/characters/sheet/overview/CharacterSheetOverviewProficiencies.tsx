import { Text, Title } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import * as overviewStyles from './overview.css'
import * as proficiencyStyles from './proficiencies.css'
import * as panelStyles from '../shared/panel.css'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import type { CharacterSheet } from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'
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
    <div className={proficiencyStyles.proficiencyPanelGrid}>
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
      className={`${proficiencyStyles.proficiencyPanel} ${proficiencyStyles.savingThrowsPanel}`}
      aria-labelledby='character-sheet-saving-throws'
    >
      <div className={overviewStyles.overviewPanelHeader}>
        <div>
          <Title id='character-sheet-saving-throws' className={panelStyles.panelTitle}>
            Saving Throws
          </Title>
        </div>
      </div>
      <div className={`${proficiencyStyles.proficiencyList} ${proficiencyStyles.savingThrowsList}`}>
        {savingThrows.map((save) => (
          <button
            aria-label={`Inspect ${save.label} saving throw. ${formatProficiencyLevel(
              save.proficiency
            )}. Total ${formatSigned(save.total)}.`}
            className={clsx(
              proficiencyStyles.savingThrowCard,
              overviewStyles.sheetInspectorTrigger
            )}
            disabled={!openPanel}
            key={save.ability}
            type='button'
            onClick={() => openPanel?.({ kind: 'SAVING_THROW', ability: save.ability })}
          >
            <div className={proficiencyStyles.savingThrowCardHeader}>
              <span className={proficiencyStyles.savingThrowMarkerSpacer} aria-hidden='true' />
              <Text className={proficiencyStyles.savingThrowCardLabel}>
                {getAbilityShortLabel(save.ability)}
              </Text>
              <span
                className={proficiencyStyles.proficiencyDot}
                data-proficiency={save.proficiency}
                aria-hidden='true'
              />
            </div>
            <Text className={proficiencyStyles.savingThrowCardValue}>
              {formatSigned(save.total)}
            </Text>
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
      className={`${proficiencyStyles.proficiencyPanel} ${proficiencyStyles.skillsPanel}`}
      aria-labelledby='character-sheet-skills'
    >
      <div className={overviewStyles.overviewPanelHeader}>
        <div>
          <button
            className={overviewStyles.panelHeadingTrigger}
            disabled={!openPanel}
            type='button'
            onClick={() => openPanel?.({ kind: 'SKILLS' })}
          >
            <Title id='character-sheet-skills' className={panelStyles.panelTitle}>
              Skills
            </Title>
            <ChevronRight aria-hidden='true' size={16} />
          </button>
        </div>
      </div>
      <div className={`${proficiencyStyles.proficiencyList} ${proficiencyStyles.skillsList}`}>
        <div className={proficiencyStyles.skillTableHeader}>
          <Text>Skill</Text>
          <Text>Abil.</Text>
          <Text>Prof.</Text>
          <Text>Mod.</Text>
          <Text>Total</Text>
        </div>
        {skills.map((skill) => (
          <button
            className={clsx(proficiencyStyles.skillRow, overviewStyles.sheetInspectorTrigger)}
            disabled={!openPanel}
            key={skill.code}
            type='button'
            onClick={() => openPanel?.({ kind: 'SKILL', skillId: skill.skillId })}
          >
            <div>
              <Text className={proficiencyStyles.proficiencyName}>{skill.label}</Text>
            </div>
            <Text className={proficiencyStyles.proficiencyMeta}>
              {getAbilityShortLabel(skill.ability)}
            </Text>
            <span
              className={proficiencyStyles.proficiencyDot}
              data-proficiency={skill.proficiency}
              aria-label={formatProficiencyLevel(skill.proficiency)}
              role='img'
            />
            <Text className={proficiencyStyles.proficiencyMeta}>
              {formatSigned(abilityModifiers.get(skill.ability) ?? 0)}
            </Text>
            <Text className={proficiencyStyles.proficiencyTotal}>{formatSigned(skill.total)}</Text>
          </button>
        ))}
      </div>
    </section>
  )
}
