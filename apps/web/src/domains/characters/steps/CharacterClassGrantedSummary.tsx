import { Text } from '@mantine/core'
import * as styles from '../characterBuilder.css'

export function CharacterClassGrantedSummary({
  featureLabels,
  resourceLabels,
  spellcastingLabels
}: {
  featureLabels: string[]
  resourceLabels: string[]
  spellcastingLabels: string[]
}) {
  const summary = [
    ...featureLabels.map((label) => `Feature: ${label}`),
    ...resourceLabels.map((label) => `Resource: ${label}`),
    ...spellcastingLabels.map((label) => `Spellcasting: ${label}`)
  ]

  if (summary.length === 0) {
    return <Text className={styles.mutedText} size='sm'>No class grants are active at this level yet.</Text>
  }

  return <Text className={styles.mutedText} size='sm'>{summary.join(' | ')}</Text>
}
