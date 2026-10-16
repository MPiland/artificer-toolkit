/**
 * The authored scaling row a bound level reaches: the row with the highest `level` at or below
 * `boundLevel`, the lowest `order` among rows on that level, or null when every row sits above it.
 * Every System scaling reader selects through this one rule; a reader that shows a row below every
 * level (the Sheet) chooses its own fallback.
 */
export function selectScalingRow<Row extends { readonly level: unknown; readonly order: unknown }>(
  rows: readonly Row[],
  boundLevel: number
): Row | null {
  let selected: (Row & { readonly level: number; readonly order: number }) | null = null
  for (const row of rows) {
    const { level, order } = row
    if (typeof level !== 'number' || typeof order !== 'number' || level > boundLevel) continue
    if (
      selected === null ||
      level > selected.level ||
      (level === selected.level && order < selected.order)
    )
      selected = row as Row & { readonly level: number; readonly order: number }
  }
  return selected
}
