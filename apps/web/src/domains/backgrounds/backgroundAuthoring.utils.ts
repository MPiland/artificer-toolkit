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
  const set = next.sets[0] ?? createEmptyStartingEquipment().sets[0]
  const group = set.groups[0] ?? createEmptyStartingEquipment().sets[0].groups[0]
  const option = group.options[0] ?? createEmptyStartingEquipment().sets[0].groups[0].options[0]
  const itemCount = option.items.length

  return {
    ...next,
    sets: [{
      ...set,
      groups: [{
        ...group,
        options: [{
          ...option,
          items: [
            ...option.items,
            createEmptyStartingEquipmentItem(itemCount + 1)
          ]
        }]
      }]
    }]
  }
}

export function upsertStartingEquipmentItem(
  startingEquipment: StartingEquipmentDto | undefined,
  item: StartingEquipmentItemDto
): StartingEquipmentDto {
  const next = startingEquipment ?? createEmptyStartingEquipment()
  const set = next.sets[0] ?? createEmptyStartingEquipment().sets[0]
  const group = set.groups[0] ?? createEmptyStartingEquipment().sets[0].groups[0]
  const option = group.options[0] ?? createEmptyStartingEquipment().sets[0].groups[0].options[0]
  const hasItem = option.items.some((current) => current.id === item.id)

  return {
    ...next,
    sets: [{
      ...set,
      groups: [{
        ...group,
        options: [{
          ...option,
          items: hasItem
            ? option.items.map((current) => current.id === item.id ? item : current)
            : [...option.items, item]
        }]
      }]
    }]
  }
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
