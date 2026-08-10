import type { StartingEquipmentItemDto } from '../rendering/startingEquipmentDefaults'

export type GuidedStartingEquipmentItem = StartingEquipmentItemDto & {
  authoringModeKind: 'SELECTED'
  equipmentIds: string[]
  quantity: number
  selectionKind: 'GRANTED'
  startingEquipmentKind: 'EQUIPMENT'
}

export function createGuidedStartingEquipmentItem(order: number): GuidedStartingEquipmentItem {
  return {
    authoringModeKind: 'SELECTED',
    equipmentIds: [],
    id: crypto.randomUUID(),
    order,
    quantity: 1,
    selectionKind: 'GRANTED',
    startingEquipmentKind: 'EQUIPMENT'
  }
}

export function isGuidedStartingEquipmentItem(
  item: StartingEquipmentItemDto
): item is GuidedStartingEquipmentItem {
  return (
    item.startingEquipmentKind === 'EQUIPMENT' &&
    item.selectionKind === 'GRANTED' &&
    item.authoringModeKind === 'SELECTED'
  )
}
