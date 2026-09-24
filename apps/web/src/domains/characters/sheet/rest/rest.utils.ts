import type { CharacterRestPreviewResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'

export function formatRestRecoveryLabels(
  recoveries: CharacterRestPreviewResponseDto['automaticRecoveries']
) {
  const labels = [...recoveries.resources, ...recoveries.spellSlots].map((item) => item.label)
  return labels.length ? labels.join(', ') : 'None'
}

export function formatCompanionRecovery(
  companion: CharacterRestPreviewResponseDto['eligibleCompanions'][number]
) {
  const hitDice = companion.hitDice
    .filter((pool) => pool.recovered > 0)
    .map((pool) => `${pool.recovered}d${pool.die}`)
  const resources = companion.resources.map((resource) => resource.label)
  return [...hitDice, ...resources].join(', ') || 'No eligible recovery'
}
