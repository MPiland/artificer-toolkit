import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared'
import {
  createEmptyStartingEquipment,
  createEmptyStartingEquipmentItem,
  getStartingEquipmentItems,
  replaceStartingEquipmentItem,
  upsertStartingEquipmentItem
} from '#app/forms/rendering/startingEquipmentDefaults'
import { createEmptyBackground, normalizeBackgroundForSubmit } from '../backgroundAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

type StartingEquipmentItemDto =
  StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]
type GrantedEquipmentStartingEquipmentItemDto = Extract<
  StartingEquipmentItemDto,
  { selectionKind: 'GRANTED'; startingEquipmentKind: 'EQUIPMENT' }
>

describe('background authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a draft background with editable collection defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    const background = createEmptyBackground({ systemId: 'dnd-5e-srd' })

    expect(background).toMatchObject({
      kind: 'BACKGROUND',
      id: generatedId,
      label: '',
      status: 'DRAFT',
      details: [],
      proficiencies: [],
      features: [],
      systemId: 'dnd-5e-srd'
    })
    expect(background.startingEquipment?.sets).toEqual([])
  })

  it('normalizes missing optional collections before save', () => {
    const background = createEmptyBackground({ systemId: 'dnd-5e-srd' })
    const normalized = normalizeBackgroundForSubmit({
      ...background,
      label: '  ',
      description: undefined,
      details: undefined,
      proficiencies: undefined,
      features: undefined,
      startingEquipment: undefined
    })

    expect(normalized.label).toBe('')
    expect(normalized.description).toBe('')
    expect(normalized.details).toEqual([])
    expect(normalized.proficiencies).toEqual([])
    expect(normalized.features).toEqual([])
    expect(normalized.startingEquipment?.sets).toEqual([])
  })

  it('appends, replaces, and upserts starting equipment items without pagination-style state', () => {
    const empty = createEmptyStartingEquipment()
    const withItem = upsertStartingEquipmentItem(empty, createEmptyStartingEquipmentItem(1))
    const item = expectEquipmentItem(getStartingEquipmentItems(withItem)[0])

    expect(withItem.sets[0]?.groups[0]?.options[0]?.items).toHaveLength(1)
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
    expect(expectEquipmentItem(getStartingEquipmentItems(replaced)[0]).quantity).toBe(2)

    const upserted = upsertStartingEquipmentItem(empty, {
      ...item,
      quantity: 3
    })
    expect(expectEquipmentItem(getStartingEquipmentItems(upserted)[0]).quantity).toBe(3)
  })

  it('preserves every starting-equipment branch when saving one item', () => {
    const equipment = createBranchedStartingEquipment()

    const updated = upsertStartingEquipmentItem(equipment, {
      ...expectEquipmentItem(equipment.sets[1]?.groups[0]?.options[1]?.items[0]),
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
    expect(expectEquipmentItem(updated.sets[1]?.groups[0]?.options[1]?.items[0]).quantity).toBe(9)
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

function expectEquipmentItem(
  item: StartingEquipmentItemDto | undefined
): GrantedEquipmentStartingEquipmentItemDto {
  expect(item?.startingEquipmentKind).toBe('EQUIPMENT')
  if (item?.startingEquipmentKind === 'EQUIPMENT') {
    expect(item.selectionKind).toBe('GRANTED')
  }
  if (!item || item.startingEquipmentKind !== 'EQUIPMENT' || item.selectionKind !== 'GRANTED') {
    throw new Error('Expected a granted equipment starting item.')
  }
  return item
}
