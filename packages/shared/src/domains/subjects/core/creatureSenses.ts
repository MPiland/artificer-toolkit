import type { CreatureSenseAuthored } from '#authored'
import { MEASUREMENT_UNIT_REGISTRY } from '../../core/measurement.js'

/**
 * A Creature's Senses as a stat block prints them ("darkvision 60 ft. (blind beyond this radius)").
 * The text is derived from the structured entries; it is never stored beside them.
 */
export function printCreatureSenses(
  senses: readonly CreatureSenseAuthored[],
  senseLabel: (senseDefinitionId: string) => string
): string[] {
  return senses.map(({ senseDefinitionId, range, qualifier }) =>
    [
      senseLabel(senseDefinitionId).toLowerCase(),
      range.rangeKind === 'DISTANCE'
        ? `${range.amount} ${MEASUREMENT_UNIT_REGISTRY[range.unit].short}`
        : 'unlimited',
      qualifier
    ]
      .filter(Boolean)
      .join(' ')
  )
}
