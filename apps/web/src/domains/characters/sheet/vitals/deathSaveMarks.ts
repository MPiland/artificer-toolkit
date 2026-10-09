/** The mark count after the mark at `index` (0-based) is toggled: marks fill and clear from the end. */
export function marksAfterToggle(count: number, index: number): number {
  return index < count ? index : index + 1
}
