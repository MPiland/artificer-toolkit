import {
  inventoryHeldItemSchema,
  type InventoryHeldItem
} from '@artificer-toolkit/schema/shared/inventoryItem'

/** The source collection and occupied containers are complete for the selected item's forest. */
export function planInventoryItemTransfer(input: {
  sourceItems: readonly InventoryHeldItem[]
  itemId: string
  amount: number
  occupiedContainerIds: ReadonlySet<string>
}) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new Error('Transfer amount must be a positive safe integer.')
  const byId = new Map<string, InventoryHeldItem>()
  const children = new Map<string, InventoryHeldItem[]>()
  for (const source of input.sourceItems) {
    const item = inventoryHeldItemSchema.parse(source)
    if (byId.has(item.id)) throw new Error('Stored inventory has duplicate item identities.')
    byId.set(item.id, item)
    if (item.containerId) {
      const siblings = children.get(item.containerId) ?? []
      siblings.push(item)
      children.set(item.containerId, siblings)
    }
  }
  const root = byId.get(input.itemId)
  if (!root || input.amount > root.quantity) throw new Error('Item is not available.')
  const forest = [root]
  const movedIds = new Set([root.id])
  for (let index = 0; index < forest.length; index++) {
    for (const child of children.get(forest[index]!.id) ?? []) {
      if (movedIds.has(child.id)) throw new Error('Stored inventory contains a container cycle.')
      movedIds.add(child.id)
      forest.push(child)
    }
  }
  const populated = new Set(input.occupiedContainerIds)
  for (const item of forest) if ((children.get(item.id)?.length ?? 0) > 0) populated.add(item.id)
  const hasContents = forest.length > 1 || populated.has(root.id)
  const sourceItems: InventoryHeldItem[] = []
  const destinationItems: InventoryHeldItem[] = []
  if (hasContents) {
    destinationItems.push({ ...root, quantity: 1, containerId: null })
    if (root.quantity > input.amount)
      sourceItems.push({ ...root, id: crypto.randomUUID(), quantity: root.quantity - input.amount })
    if (input.amount > 1)
      destinationItems.push({
        ...root,
        id: crypto.randomUUID(),
        quantity: input.amount - 1,
        containerId: null
      })
    for (const child of forest.slice(1)) {
      if (populated.has(child.id) && child.quantity > 1) {
        destinationItems.push({ ...child, quantity: 1 })
        destinationItems.push({ ...child, id: crypto.randomUUID(), quantity: child.quantity - 1 })
      } else destinationItems.push(child)
    }
  } else if (input.amount === root.quantity) {
    destinationItems.push({ ...root, containerId: null })
  } else {
    sourceItems.push({ ...root, quantity: root.quantity - input.amount })
    destinationItems.push({
      ...root,
      id: crypto.randomUUID(),
      quantity: input.amount,
      containerId: null
    })
  }
  return { root, movedIds, sourceItems, destinationItems }
}
