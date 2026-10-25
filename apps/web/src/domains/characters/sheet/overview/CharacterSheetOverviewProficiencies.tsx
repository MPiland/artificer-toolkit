import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Text, Title } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import * as overviewStyles from './overview.css'
import * as proficiencyStyles from './proficiencies.css'
import * as panelStyles from '../shared/panel.css'
import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { formatSigned } from '../core/characterSheet.utils'
import { formatProficiencyLevel } from './characterSheetOverview.utils'
import { CharacterSheetRollValue } from '../dice/CharacterSheetRollValue'
import { withRollModifier } from '../dice/dice.utils'

export function CharacterSheetSavingThrowsPanel({
  savingThrows,
  openPanel,
  headingId = 'character-sheet-saving-throws'
}: {
  savingThrows: CharacterSheetCommonDto['overview']['savingThrows']
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
  headingId?: string
}) {
  return (
    <section
      className={clsx(
        panelStyles.panel,
        proficiencyStyles.proficiencyPanel,
        proficiencyStyles.savingThrowsPanel
      )}
      aria-labelledby={headingId}
    >
      <div className={overviewStyles.overviewPanelHeader}>
        <div>
          <Title id={headingId} className={proficiencyStyles.proficiencyHeading}>
            Saving Throws
          </Title>
        </div>
      </div>
      <div className={`${proficiencyStyles.proficiencyList} ${proficiencyStyles.savingThrowsList}`}>
        {savingThrows.map((save) => (
          <div
            aria-label={`${save.label} saving throw. ${formatProficiencyLevel(
              save.proficiency
            )}. Total ${formatSigned(save.total)}.`}
            className={proficiencyStyles.savingThrowCard}
            key={save.ability}
          >
            <div className={proficiencyStyles.savingThrowCardHeader}>
              <span className={proficiencyStyles.savingThrowMarkerSpacer} aria-hidden='true' />
              <button
                aria-label={`Inspect ${save.label} saving throw`}
                className={proficiencyStyles.savingThrowInspectorTrigger}
                disabled={!openPanel}
                type='button'
                onClick={() => openPanel?.({ kind: 'SAVING_THROW', ability: save.ability })}
              >
                {save.short}
              </button>
              <span
                className={proficiencyStyles.proficiencyDot}
                data-proficiency={save.proficiency}
                aria-hidden='true'
              />
            </div>
            <Text className={proficiencyStyles.savingThrowCardValue} component='div'>
              <CharacterSheetRollValue
                request={{
                  expression: withRollModifier('1d20', save.total),
                  rollMode: save.rollMode,
                  source: { kind: 'SAVING_THROW', label: `${save.label} saving throw` }
                }}
              >
                {formatSigned(save.total)}
              </CharacterSheetRollValue>
            </Text>
          </div>
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
  abilities?: CharacterSheetCommonDto['overview']['abilities']
  skills: CharacterSheetCommonDto['overview']['skills']
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  const abilityModifiers = new Map(abilities.map((ability) => [ability.ability, ability.modifier]))

  return (
    <section
      className={clsx(
        panelStyles.panel,
        proficiencyStyles.proficiencyPanel,
        proficiencyStyles.skillsPanel
      )}
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
            <Title id='character-sheet-skills' className={proficiencyStyles.proficiencyHeading}>
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
          <div className={proficiencyStyles.skillRow} key={skill.code}>
            <div>
              <button
                className={proficiencyStyles.skillInspectorTrigger}
                disabled={!openPanel}
                type='button'
                onClick={() => openPanel?.({ kind: 'SKILL', skillId: skill.skillId })}
              >
                {skill.label}
              </button>
            </div>
            <Text className={proficiencyStyles.proficiencyMeta}>{skill.abilityShort}</Text>
            <span
              className={proficiencyStyles.proficiencyDot}
              data-proficiency={skill.proficiency}
              aria-label={formatProficiencyLevel(skill.proficiency)}
              role='img'
            />
            <Text className={proficiencyStyles.proficiencyMeta}>
              {formatSigned(abilityModifiers.get(skill.ability) ?? 0)}
            </Text>
            <Text className={proficiencyStyles.proficiencyTotal} component='div'>
              <CharacterSheetRollValue
                request={{
                  expression: withRollModifier('1d20', skill.total),
                  rollMode: skill.rollMode,
                  source: { kind: 'SKILL_CHECK', label: `${skill.label} check` }
                }}
              >
                {formatSigned(skill.total)}
              </CharacterSheetRollValue>
            </Text>
          </div>
        ))}
      </div>
    </section>
  )
}
