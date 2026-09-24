import { Text } from '@mantine/core'
import { Brain, Dumbbell, Eye, Footprints, HeartPulse, Smile } from 'lucide-react'
import clsx from 'clsx'
import * as overviewStyles from './overview.css'
import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { CharacterSheet } from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'
import { getAbilityShortLabel } from './characterSheetOverview.utils'
import { CharacterSheetRollValue } from '../dice/CharacterSheetRollValue'
import { withRollModifier } from '../dice/dice.utils'

const ABILITY_ICONS = {
  STRENGTH: Dumbbell,
  DEXTERITY: Footprints,
  CONSTITUTION: HeartPulse,
  INTELLIGENCE: Brain,
  WISDOM: Eye,
  CHARISMA: Smile
} as const

const ABILITY_LABELS = {
  STRENGTH: 'Strength',
  DEXTERITY: 'Dexterity',
  CONSTITUTION: 'Constitution',
  INTELLIGENCE: 'Intelligence',
  WISDOM: 'Wisdom',
  CHARISMA: 'Charisma'
} as const

export function CharacterSheetOverviewAbilities({
  abilities,
  openPanel
}: {
  abilities: CharacterSheet['overview']['abilities']
  openPanel?: (target: CharacterSheetPanelTargetDto) => void
}) {
  return (
    <section className={overviewStyles.abilityStrip} aria-label='Ability scores'>
      {abilities.map((ability) => (
        <div className={overviewStyles.abilityCard} key={ability.ability}>
          {(() => {
            const Icon = ABILITY_ICONS[ability.ability as keyof typeof ABILITY_ICONS]
            return Icon ? (
              <Icon className={overviewStyles.abilityIcon} aria-hidden='true' size={16} />
            ) : null
          })()}
          <button
            aria-label={`Inspect ${ABILITY_LABELS[ability.ability]} ability`}
            className={clsx(overviewStyles.abilityLabel, overviewStyles.abilityInspectorTrigger)}
            disabled={!openPanel}
            type='button'
            onClick={() => openPanel?.({ kind: 'ABILITY', ability: ability.ability })}
          >
            {getAbilityShortLabel(ability.ability)}
          </button>
          <div
            aria-label={`Score ${ability.score}, modifier ${formatSigned(ability.modifier)}`}
            className={overviewStyles.abilityValues}
          >
            <Text className={overviewStyles.abilityScore} component='span'>
              {ability.score}
            </Text>
            <span aria-hidden='true'>/</span>
            <Text className={overviewStyles.abilityModifier} component='span'>
              <CharacterSheetRollValue
                request={{
                  expression: withRollModifier('1d20', ability.modifier),
                  rollMode: ability.rollMode,
                  source: {
                    kind: 'ABILITY_CHECK',
                    label: `${ABILITY_LABELS[ability.ability]} check`
                  }
                }}
              >
                {formatSigned(ability.modifier)}
              </CharacterSheetRollValue>
            </Text>
          </div>
        </div>
      ))}
    </section>
  )
}
