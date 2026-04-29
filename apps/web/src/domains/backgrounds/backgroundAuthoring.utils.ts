import type {
  BackgroundAuthoredDto,
  DetailDto,
  FeatureDto,
  ProficiencyGrantDto,
  StartingEquipmentDto
} from '@artificer-toolkit/schema'

type StartingEquipmentItemDto = StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]

export type BackgroundFormStep = 'basics' | 'content' | 'details'

export interface CreateEmptyBackgroundInput {
  systemId: string
  userId: string
}

export function createEmptyBackground({
  systemId,
  userId
}: CreateEmptyBackgroundInput): BackgroundAuthoredDto {
  return {
    kind: 'BACKGROUND',
    id: crypto.randomUUID(),
    label: '',
    description: '',
    status: 'DRAFT',
    details: [],
    proficiencies: [],
    features: [],
    startingEquipment: createEmptyStartingEquipment(),
    userId,
    systemId
  }
}

export function normalizeBackgroundForSubmit(background: BackgroundAuthoredDto): BackgroundAuthoredDto {
  return {
    ...background,
    label: background.label.trim() || 'Untitled Background',
    description: background.description ?? '',
    status: background.status ?? 'DRAFT',
    details: background.details ?? [],
    proficiencies: background.proficiencies ?? [],
    features: background.features ?? [],
    startingEquipment: background.startingEquipment ?? createEmptyStartingEquipment()
  }
}

export function createEmptyDetail(order: number): DetailDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order
  }
}

export function createEmptyProficiency(order: number): ProficiencyGrantDto {
  return {
    grantKind: 'PROFICIENCY_GRANT',
    id: crypto.randomUUID(),
    order,
    selectionKind: 'GRANTED',
    proficiencyKind: 'SKILL',
    authoringModeKind: 'ALL',
    level: 'FULL'
  }
}

export function createEmptyFeature(order: number): FeatureDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order
  }
}

export function createEmptyStartingEquipment(): StartingEquipmentDto {
  return {
    id: crypto.randomUUID(),
    sets: [{
      id: crypto.randomUUID(),
      order: 1,
      groups: [{
        id: crypto.randomUUID(),
        order: 1,
        options: [{
          id: crypto.randomUUID(),
          order: 1,
          items: []
        }]
      }]
    }]
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
  replacement: StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]
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
  return startingEquipment?.sets.flatMap((set) =>
    set.groups.flatMap((group) =>
      group.options.flatMap((option) => option.items)
    )
  ) ?? []
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
