import { Text } from '@mantine/core'
import * as styles from '../characterBuilder.css'

export function CharacterClassGrantedSummary({
  resourceLabels,
  spellcastingLabels
}: {
  resourceLabels: string[]
  spellcastingLabels: string[]
}) {
  const summary = [
    ...resourceLabels.map((label) => `Resource: ${label}`),
    ...spellcastingLabels.map((label) => `Spellcasting: ${label}`)
  ]

  if (summary.length === 0) {
    return null
  }

  return <Text className={styles.mutedText} size='sm'>{summary.join(' | ')}</Text>
}
