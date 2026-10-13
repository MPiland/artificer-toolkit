import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'

type EncounterActionRange = NonNullable<EncounterActionChoiceDto['range']>

/** A single-target Touch action reaches an adjacent creature: a 5-foot range that only warns. */
export const TOUCH_RANGE = { amount: 5, unit: 'FEET' } as const

/**
 * The range the target policy enforces, for the client's range preview; null for a range the
 * policy evaluator cannot measure (sight, special).
 */
export function encounterActionRange(
  policy: CompiledActionTargetPolicy
): EncounterActionRange | null {
  const { range } = policy
  switch (range.rangeKind) {
    case 'SELF':
      return { kind: 'SELF' }
    case 'UNLIMITED':
      return { kind: 'UNLIMITED' }
    case 'TOUCH':
      return { kind: 'WITHIN', distance: TOUCH_RANGE }
    case 'DISTANCE':
      return range.longAmount === undefined
        ? { kind: 'WITHIN', distance: { amount: range.amount, unit: range.unit } }
        : {
            kind: 'RANGED',
            normal: { amount: range.amount, unit: range.unit },
            long: { amount: range.longAmount, unit: range.unit }
          }
    default:
      return null
  }
}

const UNIT_LABELS: Record<string, string> = {
  FEET: 'ft',
  FOOT: 'ft',
  MILES: 'mi',
  MILE: 'mi',
  METERS: 'm',
  METER: 'm'
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

/** "5 ft", or "1.5 mi": a length in the unit's short form. */
export function formatRangeLength(length: { amount: number; unit: string }): string {
  return `${formatAmount(length.amount)} ${UNIT_LABELS[length.unit] ?? titleCase(length.unit)}`
}

/** The one label for a range: "Self", "5 ft", "150/600 ft", "Unlimited". */
export function encounterActionRangeLabel(range: EncounterActionRange): string {
  switch (range.kind) {
    case 'SELF':
      return 'Self'
    case 'UNLIMITED':
      return 'Unlimited'
    case 'WITHIN':
      return formatRangeLength(range.distance)
    case 'RANGED':
      return `${formatAmount(range.normal.amount)}/${formatRangeLength(range.long)}`
  }
}

/**
 * The `range` and `rangeLabel` of an action choice: both from the policy when it has a measurable
 * range, otherwise only the label the action already carries.
 */
export function encounterActionChoiceRange(
  policy: CompiledActionTargetPolicy | undefined,
  fallbackLabel?: string
): Pick<EncounterActionChoiceDto, 'range' | 'rangeLabel'> {
  const range = policy ? encounterActionRange(policy) : null
  if (range) return { range, rangeLabel: encounterActionRangeLabel(range) }
  return fallbackLabel ? { rangeLabel: fallbackLabel } : {}
}
