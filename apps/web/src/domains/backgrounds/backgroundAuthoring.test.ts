import { afterEach, describe, expect, it, vi } from 'vitest'
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
})
