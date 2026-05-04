import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared'

export type StartingEquipmentItemDto = StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]

export function createEmptyStartingEquipment(): StartingEquipmentDto {
  return {
    id: crypto.randomUUID(),
    sets: [
      {
        id: crypto.randomUUID(),
        order: 1,
        groups: [
          {
            id: crypto.randomUUID(),
            order: 1,
            options: [
              {
                id: crypto.randomUUID(),
                order: 1,
                items: []
              }
            ]
          }
        ]
      }
    ]
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

export function addStartingEquipmentItem(startingEquipment: StartingEquipmentDto | undefined): StartingEquipmentDto {
  const next = startingEquipment ?? createEmptyStartingEquipment()
  const itemCount = getStartingEquipmentItems(next).length

  return appendStartingEquipmentItem(next, createEmptyStartingEquipmentItem(itemCount + 1))
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
  return {
    ...startingEquipment,
    sets: startingEquipment.sets.map((set) => ({
      ...set,
      groups: set.groups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({
          ...option,
          items: option.items.map((item) => item.id === itemId ? replacement : item)
        }))
      }))
    }))
  }
}

export function removeStartingEquipmentItem(startingEquipment: StartingEquipmentDto, itemId: string): StartingEquipmentDto {
  return {
    ...startingEquipment,
    sets: startingEquipment.sets.map((set) => ({
      ...set,
      groups: set.groups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({
          ...option,
          items: option.items.filter((item) => item.id !== itemId)
        }))
      }))
    }))
  }
}

export function getStartingEquipmentItems(startingEquipment: StartingEquipmentDto | undefined) {
  return startingEquipment?.sets.flatMap((set) => set.groups.flatMap((group) => group.options.flatMap((option) => option.items))) ?? []
}

export function getStartingEquipmentItemFieldPath(
  startingEquipment: StartingEquipmentDto,
  itemId: string
): string | undefined {
  for (const [setIndex, set] of startingEquipment.sets.entries()) {
    for (const [groupIndex, group] of set.groups.entries()) {
      for (const [optionIndex, option] of group.options.entries()) {
        const itemIndex = option.items.findIndex((item) => item.id === itemId)
        if (itemIndex >= 0) {
          return `sets[${setIndex}].groups[${groupIndex}].options[${optionIndex}].items[${itemIndex}]`
        }
      }
    }
  }

  return undefined
}

export function formatStartingEquipmentTitle(item: StartingEquipmentItemDto): string {
  return item.startingEquipmentKind === 'CURRENCY' ? 'Currency' : 'Equipment'
}

export function formatStartingEquipmentDescription(item: StartingEquipmentItemDto): string {
  if (item.startingEquipmentKind === 'CURRENCY') {
    return item.currencies.map((currency) => `${currency.amount} ${currency.currencyId}`).join(', ') || 'No currency selected yet.'
  }

  const amount = item.selectionKind === 'CHOSEN'
    ? `Player chooses ${item.count ?? 1}`
    : `Grants ${item.quantity ?? 1}`
  const target = item.authoringModeKind === 'SELECTED'
    ? `${item.equipmentIds.length} selected option${item.equipmentIds.length === 1 ? '' : 's'}`
    : 'matching equipment'

  return `${amount} from ${target}.`
}

function appendStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto,
  item: StartingEquipmentItemDto
): StartingEquipmentDto {
  if (startingEquipment.sets.length === 0) {
    return {
      ...startingEquipment,
      sets: [createEmptyStartingEquipmentSet(item)]
    }
  }

  let appended = false

  return {
    ...startingEquipment,
    sets: startingEquipment.sets.map((set) => {
      if (appended) return set

      if (set.groups.length === 0) {
        appended = true
        return {
          ...set,
          groups: [createEmptyStartingEquipmentGroup(item)]
        }
      }

      return {
        ...set,
        groups: set.groups.map((group) => {
          if (appended) return group

          if (group.options.length === 0) {
            appended = true
            return {
              ...group,
              options: [createEmptyStartingEquipmentOption(item)]
            }
          }

          appended = true
          const [firstOption, ...remainingOptions] = group.options

          return {
            ...group,
            options: [
              {
                ...firstOption,
                items: [...firstOption.items, item]
              },
              ...remainingOptions
            ]
          }
        })
      }
    })
  }
}

function createEmptyStartingEquipmentSet(
  item: StartingEquipmentItemDto
): StartingEquipmentDto['sets'][number] {
  const set = createEmptyStartingEquipment().sets[0]

  return {
    ...set,
    groups: [createEmptyStartingEquipmentGroup(item)]
  }
}

function createEmptyStartingEquipmentGroup(
  item: StartingEquipmentItemDto
): StartingEquipmentDto['sets'][number]['groups'][number] {
  const group = createEmptyStartingEquipment().sets[0].groups[0]

  return {
    ...group,
    options: [createEmptyStartingEquipmentOption(item)]
  }
}

function createEmptyStartingEquipmentOption(
  item: StartingEquipmentItemDto
): StartingEquipmentDto['sets'][number]['groups'][number]['options'][number] {
  const option = createEmptyStartingEquipment().sets[0].groups[0].options[0]

  return {
    ...option,
    items: [item]
  }
}
