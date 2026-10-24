import { systemCoreCodeRegistry } from './platformSystemCoreCodes.js'

/** A size's step in its System's size list, smallest first; null for a missing or unknown size. */
export function sizeRank(gameSystemId: string, size: string | null | undefined): number | null {
  const sizes = systemCoreCodeRegistry.entries(gameSystemId, 'size')
  const rank = size == null ? -1 : sizes.findIndex(({ code }) => code === size)
  return rank === -1 ? null : rank
}

/** The edge in feet of the space a creature of `size` fills; null for a missing size or one with no modelled space. */
export function sizeSpaceFeet(
  gameSystemId: string,
  size: string | null | undefined
): number | null {
  const sizes = systemCoreCodeRegistry.entries(gameSystemId, 'size')
  return sizes.find(({ code }) => code === size)?.spaceFeet ?? null
}
