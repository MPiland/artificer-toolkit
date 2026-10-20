import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import { AmmunitionChoiceError } from '../encounterErrors.js'

export type AmmunitionStack = NonNullable<
  NonNullable<CharacterActionCandidate['equipment']>['ammunitionStacks']
>[number]

type AmmunitionInventory = readonly { id: string; quantity: number }[]

const stackQuantity = (stack: AmmunitionStack, inventory: AmmunitionInventory) =>
  inventory.find((row) => row.id === stack.itemInstanceId)?.quantity ?? 0

/** The stacks of the Character's ammunition that fit the weapon and have a piece left, with their count. */
export function ammunitionInStock(
  equipment: CharacterActionCandidate['equipment'],
  inventory: AmmunitionInventory
): (AmmunitionStack & { quantity: number })[] {
  return (equipment?.ammunitionStacks ?? []).flatMap((stack) => {
    const quantity = stackQuantity(stack, inventory)
    return quantity >= 1 ? [{ ...stack, quantity }] : []
  })
}

/**
 * The ammunition a weapon attack fires: the stack the command names, else the only stack in stock.
 * Null for a weapon that uses none; a null `stack` means no piece is left to fire (ATTACK-19.4).
 * A `preview` read has no command to choose for, so several stacks in stock show the first.
 * `inventory` is the effective one, so a used-up stack has no row.
 */
export function selectAmmunition(input: {
  equipment: CharacterActionCandidate['equipment']
  inventory: AmmunitionInventory
  requestedItemInstanceId?: string
  preview?: boolean
}): { stack: AmmunitionStack | null; remaining: number } | null {
  const { equipment } = input
  if (!equipment?.ammunitionEquipmentId) return null
  const stacks = equipment.ammunitionStacks ?? []
  const requested =
    input.requestedItemInstanceId === undefined
      ? undefined
      : stacks.find(({ itemInstanceId }) => itemInstanceId === input.requestedItemInstanceId)
  if (input.requestedItemInstanceId !== undefined && !requested)
    throw new AmmunitionChoiceError('That ammunition does not fit this weapon.')
  const inStock = ammunitionInStock(equipment, input.inventory)
  if (!requested && !input.preview && inStock.length > 1)
    throw new AmmunitionChoiceError('Choose which ammunition to fire.')
  const stack = requested ?? inStock[0] ?? null
  return { stack, remaining: stack ? stackQuantity(stack, input.inventory) : 0 }
}
