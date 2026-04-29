import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema'
import {
  addStartingEquipmentItem,
  createEmptyBackground,
  createEmptyStartingEquipment,
  getStartingEquipmentItems,
  normalizeBackgroundForSubmit,
  removeStartingEquipmentItem,
  replaceStartingEquipmentItem,
  upsertStartingEquipmentItem
} from './backgroundAuthoring.utils'

describe('background authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a draft background with editable collection defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-id')

    const background = createEmptyBackground({ systemId: 'dnd-5e-srd', userId: 'user-1' })

    expect(background).toMatchObject({
      kind: 'BACKGROUND',
      id: 'generated-id',
      label: '',
      status: 'DRAFT',
      details: [],
      proficiencies: [],
      features: [],
      userId: 'user-1',
      systemId: 'dnd-5e-srd'
    })
    expect(background.startingEquipment?.sets[0]?.groups[0]?.options[0]?.items).toEqual([])
  })

  it('normalizes missing optional collections before save', () => {
    const background = createEmptyBackground({ systemId: 'dnd-5e-srd', userId: 'user-1' })
    const normalized = normalizeBackgroundForSubmit({
      ...background,
      label: '  ',
      description: undefined,
      details: undefined,
      proficiencies: undefined,
      features: undefined,
      startingEquipment: undefined
    })

    expect(normalized.label).toBe('Untitled Background')
    expect(normalized.description).toBe('')
    expect(normalized.details).toEqual([])
    expect(normalized.proficiencies).toEqual([])
    expect(normalized.features).toEqual([])
    expect(normalized.startingEquipment?.sets).toHaveLength(1)
  })

  it('adds, replaces, and removes starting equipment items without pagination-style state', () => {
    const empty = createEmptyStartingEquipment()
    const withItem = addStartingEquipmentItem(empty)
    const item = getStartingEquipmentItems(withItem)[0]

    expect(item).toMatchObject({
      order: 1,
      startingEquipmentKind: 'EQUIPMENT',
      selectionKind: 'GRANTED',
      quantity: 1
    })

    const replaced = replaceStartingEquipmentItem(withItem, item.id, {
      ...item,
      quantity: 2
    })
    expect(getStartingEquipmentItems(replaced)[0]?.quantity).toBe(2)

    const removed = removeStartingEquipmentItem(replaced, item.id)
    expect(getStartingEquipmentItems(removed)).toEqual([])

    const upserted = upsertStartingEquipmentItem(empty, {
      ...item,
      quantity: 3
    })
    expect(getStartingEquipmentItems(upserted)[0]?.quantity).toBe(3)
  })

  it('preserves every starting-equipment branch when saving one item', () => {
    const equipment = createBranchedStartingEquipment()

    const updated = upsertStartingEquipmentItem(equipment, {
      ...equipment.sets[1].groups[0].options[1].items[0],
      quantity: 9
    })

    expect(updated.sets).toHaveLength(2)
    expect(updated.sets[0]?.groups).toHaveLength(1)
    expect(updated.sets[1]?.groups[0]?.options).toHaveLength(2)
    expect(getStartingEquipmentItems(updated).map((item) => item.id)).toEqual([
      'item-a',
      'item-b',
      'item-c'
    ])
    expect(updated.sets[1]?.groups[0]?.options[1]?.items[0]?.quantity).toBe(9)
  })

  it('preserves existing branches when adding a new starting-equipment item', () => {
    const equipment = createBranchedStartingEquipment()

    const updated = upsertStartingEquipmentItem(equipment, {
      id: 'item-new',
      order: 4,
      startingEquipmentKind: 'EQUIPMENT',
      selectionKind: 'GRANTED',
      quantity: 1,
      authoringModeKind: 'ALL'
    })

    expect(updated.sets).toHaveLength(2)
    expect(updated.sets[1]?.groups[0]?.options).toHaveLength(2)
    expect(updated.sets[0]?.groups[0]?.options[0]?.items.map((item) => item.id)).toEqual([
      'item-a',
      'item-new'
    ])
    expect(updated.sets[1]?.groups[0]?.options[0]?.items[0]?.id).toBe('item-b')
    expect(updated.sets[1]?.groups[0]?.options[1]?.items[0]?.id).toBe('item-c')
  })
})

function createBranchedStartingEquipment(): StartingEquipmentDto {
  return {
    id: 'equipment',
    sets: [
      {
        id: 'set-a',
        order: 1,
        groups: [
          {
            id: 'group-a',
            order: 1,
            options: [
              {
                id: 'option-a',
                order: 1,
                items: [
                  {
                    id: 'item-a',
                    order: 1,
                    startingEquipmentKind: 'EQUIPMENT',
                    selectionKind: 'GRANTED',
                    quantity: 1,
                    authoringModeKind: 'ALL'
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'set-b',
        order: 2,
        groups: [
          {
            id: 'group-b',
            order: 1,
            options: [
              {
                id: 'option-b',
                order: 1,
                items: [
                  {
                    id: 'item-b',
                    order: 2,
                    startingEquipmentKind: 'EQUIPMENT',
                    selectionKind: 'GRANTED',
                    quantity: 1,
                    authoringModeKind: 'ALL'
                  }
                ]
              },
              {
                id: 'option-c',
                order: 2,
                items: [
                  {
                    id: 'item-c',
                    order: 3,
                    startingEquipmentKind: 'EQUIPMENT',
                    selectionKind: 'GRANTED',
                    quantity: 2,
                    authoringModeKind: 'ALL'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
