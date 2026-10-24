import { describe, expect, it, vi, afterEach } from 'vitest'
import { createEmptyBaseEquipment, normalizeEquipmentForSubmit } from '../equipmentAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

describe('equipment authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates editable base equipment defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    const equipment = createEmptyBaseEquipment({ systemId: 'dnd-5e-srd' })

    expect(equipment).toMatchObject({
      kind: 'EQUIPMENT',
      id: generatedId,
      label: '',
      status: 'DRAFT',
      category: 'ADVENTURING_GEAR',
      properties: [],
      systemId: 'dnd-5e-srd'
    })
  })

  it('normalizes base equipment before submit', () => {
    const equipment = createEmptyBaseEquipment({ systemId: 'dnd-5e-srd' })
    const normalized = normalizeEquipmentForSubmit({
      ...equipment,
      label: '  ',
      description: '',
      requiresAttunement: true
    })

    expect(normalized).toMatchObject({
      label: 'Untitled Equipment',
      category: 'ADVENTURING_GEAR',
      properties: [],
      weight: {
        amount: 0,
        unit: 'POUNDS'
      },
      requiresAttunement: true
    })
    expect(normalized).not.toHaveProperty('userId')
    expect(normalized).not.toHaveProperty('maxBonus')
  })

  it('normalizes a variant with its selected parent', () => {
    const normalized = normalizeEquipmentForSubmit({
      kind: 'EQUIPMENT',
      id: generatedId,
      label: '',
      description: '',
      status: 'DRAFT',
      quote: '',
      rarityId: '',
      systemId: 'dnd-5e-srd',
      category: 'VARIANT',
      parentEquipmentId: 'equipment-base-1',
      properties: [],
      effects: [],
      modifiers: [],
      features: [],
      requiresAttunement: false
    })

    expect(normalized).toMatchObject({
      category: 'VARIANT',
      parentEquipmentId: 'equipment-base-1',
      properties: []
    })
    expect(normalized).not.toHaveProperty('weight')
    // Magic bonuses are authored +N modifiers; the retired maximum-bonus field is never submitted.
    expect(normalized).not.toHaveProperty('maxBonus')
  })
})
