/** An inclusive integer roll range; a `null` max is open-ended (for example 20+). */
export type LootRollRange = { min: number; max: number | null }

export const LOOT_RANGE_REFUSAL = {
  MIN_GREATER_THAN_MAX: 'LOOT_RANGE_MIN_GREATER_THAN_MAX',
  OVERLAP: 'LOOT_RANGE_OVERLAP'
} as const

export type LootRangeRefusal = {
  code: (typeof LOOT_RANGE_REFUSAL)[keyof typeof LOOT_RANGE_REFUSAL]
  message: string
  /** Indexes into the checked list, in the order given. */
  indexes: [number] | [number, number]
}

export function formatLootRange({ min, max }: LootRollRange) {
  return max === null ? `${min}+` : min === max ? `${min}` : `${min}–${max}`
}

/** The range holding a roll, or undefined when the roll falls in a gap. Ranges are exclusive, so at most one matches. */
export function findLootRangeForRoll<Range extends LootRollRange>(
  ranges: readonly Range[],
  roll: number
): Range | undefined {
  return ranges.find((range) => roll >= range.min && (range.max === null || roll <= range.max))
}

/**
 * The first refusal among a table's ranges, or null when they are exclusive. Ranges share a roll
 * when they hold a common integer, so 5–10 and 10–15 overlap while 5–10 and 11–15 do not. Gaps are
 * allowed and the list need not be sorted.
 */
export function findLootRangeRefusal(ranges: readonly LootRollRange[]): LootRangeRefusal | null {
  for (const [index, range] of ranges.entries())
    if (range.max !== null && range.min > range.max)
      return {
        code: LOOT_RANGE_REFUSAL.MIN_GREATER_THAN_MAX,
        message: `${LOOT_RANGE_REFUSAL.MIN_GREATER_THAN_MAX}: loot range ${range.min}–${range.max} starts above where it ends.`,
        indexes: [index]
      }
  const ordered = ranges
    .map((range, index) => ({ range, index }))
    .sort((a, b) => a.range.min - b.range.min)
  for (const [position, current] of ordered.entries()) {
    const next = ordered[position + 1]
    if (next && (current.range.max === null || current.range.max >= next.range.min))
      return {
        code: LOOT_RANGE_REFUSAL.OVERLAP,
        message: `${LOOT_RANGE_REFUSAL.OVERLAP}: loot ranges ${formatLootRange(current.range)} and ${formatLootRange(next.range)} share a roll.`,
        indexes: [current.index, next.index]
      }
  }
  return null
}
