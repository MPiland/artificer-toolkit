/** An item-count limit: `amount` pieces of the named Equipment or its variants, or of any item. */
export type ItemCapacityLimit = {
  readonly amount: number
  readonly equipmentIds?: readonly string[]
}

/** Pieces of one Equipment, named by its own id followed by its variant ancestry. */
export type ContainedPieces = {
  readonly equipmentIds: readonly string[]
  readonly quantity: number
}

/** Equipment holds other items when it authors a weight capacity or an item-count capacity. */
export function isContainerEquipment(equipment: {
  readonly capacity?: object
  readonly itemCapacity?: readonly ItemCapacityLimit[]
}) {
  return equipment.capacity !== undefined || (equipment.itemCapacity?.length ?? 0) > 0
}

/** An Equipment's own id followed by its variant ancestry, nearest parent first. */
export function equipmentLineage(
  equipment:
    | { readonly id: string; readonly parentEquipmentIds: readonly string[] }
    | {
        readonly id: string
        readonly variant?: { readonly ancestorEquipmentIds: readonly string[] }
      }
) {
  return [
    equipment.id,
    ...('parentEquipmentIds' in equipment
      ? equipment.parentEquipmentIds
      : (equipment.variant?.ancestorEquipmentIds ?? []))
  ]
}

/** The first limit that names the pieces' Equipment or one of its ancestors, or names none. */
function countingLimit(limits: readonly ItemCapacityLimit[], equipmentIds: readonly string[]) {
  return limits.find(
    (limit) =>
      !limit.equipmentIds?.length || limit.equipmentIds.some((id) => equipmentIds.includes(id))
  )
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  return right === 0n ? left : greatestCommonDivisor(right, left % right)
}

/**
 * Why `added` does not fit beside `contents` in a container with item-count `limits`, or
 * undefined when it fits. Limits share the container: each counted piece fills 1/amount of it,
 * checked exactly over the least common multiple of the amounts. Pieces no limit counts take no
 * room, and a container without limits never refuses.
 */
export function itemCapacityRefusal(
  container: { readonly label: string; readonly itemCapacity?: readonly ItemCapacityLimit[] },
  contents: readonly ContainedPieces[],
  added: ContainedPieces & { readonly label: string }
): string | undefined {
  const limits = container.itemCapacity ?? []
  const limit = countingLimit(limits, added.equipmentIds)
  if (!limit) return undefined
  const whole = limits.reduce((multiple, { amount }) => {
    const size = BigInt(amount)
    return (multiple * size) / greatestCommonDivisor(multiple, size)
  }, 1n)
  const used = contents.reduce((total, pieces) => {
    const counted = countingLimit(limits, pieces.equipmentIds)
    return counted ? total + BigInt(pieces.quantity) * (whole / BigInt(counted.amount)) : total
  }, 0n)
  const free = whole > used ? whole - used : 0n
  const room = free / (whole / BigInt(limit.amount))
  if (BigInt(added.quantity) <= room) return undefined
  return room === 0n
    ? `"${container.label}" has no room for "${added.label}".`
    : `"${container.label}" has room for only ${room} more "${added.label}".`
}
