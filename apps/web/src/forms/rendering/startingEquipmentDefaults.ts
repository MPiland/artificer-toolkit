import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared/startingEquipment'

export type StartingEquipmentItemDto =
  StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]

export function createEmptyStartingEquipment(): StartingEquipmentDto {
  return {
    id: crypto.randomUUID(),
    sets: []
  }
}

export function createEmptyStartingEquipmentItem(order: number): StartingEquipmentItemDto {
  return {
    id: crypto.randomUUID(),
    order,
    startingEquipmentKind: 'EQUIPMENT',
    selectionKind: 'GRANTED',
    quantity: 1,
    authoringModeKind: 'ALL'
  }
}

export function upsertStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto | undefined,
  item: StartingEquipmentItemDto
): StartingEquipmentDto {
  const next = startingEquipment ?? createEmptyStartingEquipment()
  const hasItem = getStartingEquipmentItems(next).some((current) => current.id === item.id)

  return hasItem
    ? replaceStartingEquipmentItem(next, item.id, item)
    : appendStartingEquipmentItem(next, item)
}

export function replaceStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto,
  itemId: string,
  replacement: StartingEquipmentItemDto
): StartingEquipmentDto {
  return updateStartingEquipmentItems(startingEquipment, (items) =>
    items.map((item) => (item.id === itemId ? replacement : item))
  )
}

export function getStartingEquipmentItems(
  startingEquipment: StartingEquipmentDto | undefined
): StartingEquipmentItemDto[] {
  if (!startingEquipment) return []

  return startingEquipment.sets.flatMap((set) =>
    set.groups.flatMap((group) => group.options.flatMap((option) => option.items))
  )
}

function appendStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto,
  item: StartingEquipmentItemDto
): StartingEquipmentDto {
  const next = startingEquipment
  const [firstSet, ...remainingSets] = next.sets
  const set = firstSet ?? createStartingEquipmentSet(1)
  const [firstGroup, ...remainingGroups] = set.groups
  const group = firstGroup ?? createStartingEquipmentGroup(1)
  const [firstOption, ...remainingOptions] = group.options
  const option = firstOption ?? createStartingEquipmentOption(1)

  return {
    ...next,
    sets: [
      {
        ...set,
        groups: [
          {
            ...group,
            options: [
              {
                ...option,
                items: [...option.items, item]
              },
              ...remainingOptions
            ]
          },
          ...remainingGroups
        ]
      },
      ...remainingSets
    ]
  }
}

function createStartingEquipmentSet(order: number): StartingEquipmentDto['sets'][number] {
  return {
    id: crypto.randomUUID(),
    order,
    groups: []
  }
}

function createStartingEquipmentGroup(
  order: number
): StartingEquipmentDto['sets'][number]['groups'][number] {
  return {
    id: crypto.randomUUID(),
    order,
    options: []
  }
}

function createStartingEquipmentOption(
  order: number
): StartingEquipmentDto['sets'][number]['groups'][number]['options'][number] {
  return {
    id: crypto.randomUUID(),
    order,
    items: []
  }
}

function updateStartingEquipmentItems(
  startingEquipment: StartingEquipmentDto,
  updater: (items: StartingEquipmentItemDto[]) => StartingEquipmentItemDto[]
): StartingEquipmentDto {
  return {
    ...startingEquipment,
    sets: startingEquipment.sets.map((set) => ({
      ...set,
      groups: set.groups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({
          ...option,
          items: updater(option.items)
        }))
      }))
    }))
  }
}
