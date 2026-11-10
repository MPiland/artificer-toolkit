import { systemCoreCodeRegistry } from './platformSystemCoreCodes.js'

/** The size the System gives a new Creature or Race. */
export function defaultSize(gameSystemId: string): string {
  const size = systemCoreCodeRegistry.entries(gameSystemId, 'size').find((entry) => entry.isDefault)
  if (!size) throw new Error('The Game System does not define a default size.')
  return size.code
}

/** The sizes that fill a space a Scene models, smallest first: the ones guided authoring offers. */
export function sceneSizes(gameSystemId: string) {
  return systemCoreCodeRegistry
    .entries(gameSystemId, 'size')
    .filter((entry) => entry.spaceFeet !== undefined)
}

/** A size's step in its System's size list, smallest first; null for a missing or unknown size. */
export function sizeRank(gameSystemId: string, size: string | null | undefined): number | null {
  const sizes = systemCoreCodeRegistry.entries(gameSystemId, 'size')
  const rank = size == null ? -1 : sizes.findIndex(({ code }) => code === size)
  return rank === -1 ? null : rank
}

/**
 * Whether size falls in the inclusive range, by its step in the System size list. A missing or
 * unknown size, or a bound the System does not define, is outside the range.
 */
export function sizeInRange(
  gameSystemId: string,
  size: string | null | undefined,
  range: { minimumSizeCode?: string; maximumSizeCode?: string }
): boolean {
  const rank = sizeRank(gameSystemId, size)
  if (rank === null) return false
  const minimum =
    range.minimumSizeCode === undefined ? 0 : sizeRank(gameSystemId, range.minimumSizeCode)
  const maximum =
    range.maximumSizeCode === undefined ? Infinity : sizeRank(gameSystemId, range.maximumSizeCode)
  return minimum !== null && maximum !== null && rank >= minimum && rank <= maximum
}

/** The edge in feet of the space a creature of `size` fills; null for a missing size or one with no modelled space. */
export function sizeSpaceFeet(
  gameSystemId: string,
  size: string | null | undefined
): number | null {
  const sizes = systemCoreCodeRegistry.entries(gameSystemId, 'size')
  return sizes.find(({ code }) => code === size)?.spaceFeet ?? null
}
