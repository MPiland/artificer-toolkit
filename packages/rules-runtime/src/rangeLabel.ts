import { MEASUREMENT_UNIT_REGISTRY, type LengthUnitCode } from '@artificer-toolkit/shared/core'

import { formatCodeLabel } from './character/sheetCommandReducer.js'

export function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

/**
 * The one label for an authored range, on the Sheet and in every Encounter choice: "Touch", "Self",
 * "Unlimited", "30 ft", or "150/600 ft" with a long range. The normal and long distance share the
 * range's one unit; any other kind reads as its own name ("Sight", "Special").
 */
export function rangeLabel(range: {
  rangeKind: string
  amount?: number | null
  longAmount?: number | null
  unit?: LengthUnitCode | null
}): string {
  const { rangeKind, amount, longAmount, unit } = range
  if (rangeKind !== 'DISTANCE' || amount == null || unit == null) return formatCodeLabel(rangeKind)
  const distance =
    longAmount == null
      ? formatAmount(amount)
      : `${formatAmount(amount)}/${formatAmount(longAmount)}`
  return `${distance} ${MEASUREMENT_UNIT_REGISTRY[unit].short}`
}
