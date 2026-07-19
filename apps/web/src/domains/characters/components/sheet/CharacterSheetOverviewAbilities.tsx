import { Text } from '@mantine/core'
import { Brain, Dumbbell, Eye, Footprints, HeartPulse, Smile } from 'lucide-react'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'
import { formatSigned } from './characterSheet.utils'
import { getAbilityShortLabel } from './characterSheetOverview.utils'

const ABILITY_ICONS = {
  STRENGTH: Dumbbell,
  DEXTERITY: Footprints,
  CONSTITUTION: HeartPulse,
  INTELLIGENCE: Brain,
  WISDOM: Eye,
  CHARISMA: Smile
} as const

export function CharacterSheetOverviewAbilities({
  abilities
}: {
  abilities: CharacterSheet['overview']['abilities']
}) {
  return (
    <section className={styles.abilityStrip} aria-label='Ability scores'>
      {abilities.map((ability) => (
        <div className={styles.abilityCard} key={ability.ability}>
          {(() => {
            const Icon = ABILITY_ICONS[ability.ability as keyof typeof ABILITY_ICONS]
            return Icon ? <Icon className={styles.abilityIcon} aria-hidden='true' size={24} /> : null
          })()}
          <Text className={styles.abilityLabel}>{getAbilityShortLabel(ability.ability)}</Text>
          <Text className={styles.abilityModifier}>{formatSigned(ability.modifier)}</Text>
          <Text className={styles.abilityScore}>{ability.score}</Text>
        </div>
      ))}
    </section>
  )
}
