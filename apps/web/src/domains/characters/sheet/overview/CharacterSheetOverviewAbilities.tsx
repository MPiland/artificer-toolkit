import { Text } from '@mantine/core'
import { Brain, Dumbbell, Eye, Footprints, HeartPulse, Smile } from 'lucide-react'
import clsx from 'clsx'
import * as overviewStyles from './overview.css'
import type { CharacterSheetPanelTargetDto } from '#app/lib/api'
import type { CharacterSheet } from '../core/CharacterSheet.types'
import { formatSigned } from '../core/characterSheet.utils'
import { getAbilityShortLabel } from './characterSheetOverview.utils'

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
        <button
          aria-label={`Inspect ${ABILITY_LABELS[ability.ability]} ability`}
          className={clsx(overviewStyles.abilityCard, overviewStyles.sheetInspectorTrigger)}
          disabled={!openPanel}
          key={ability.ability}
          type='button'
          onClick={() => openPanel?.({ kind: 'ABILITY', ability: ability.ability })}
        >
          {(() => {
            const Icon = ABILITY_ICONS[ability.ability as keyof typeof ABILITY_ICONS]
            return Icon ? (
              <Icon className={overviewStyles.abilityIcon} aria-hidden='true' size={16} />
            ) : null
          })()}
          <Text className={overviewStyles.abilityLabel}>
            {getAbilityShortLabel(ability.ability)}
          </Text>
          <Text className={overviewStyles.abilityModifier}>{formatSigned(ability.modifier)}</Text>
          <Text className={overviewStyles.abilityScore}>Score {ability.score}</Text>
        </button>
      ))}
    </section>
  )
}
