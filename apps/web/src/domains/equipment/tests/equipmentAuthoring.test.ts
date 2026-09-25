import { describe, expect, it, vi, afterEach } from 'vitest'
import { facetDtoSchema } from '@artificer-toolkit/schema/shared'
import { modifierGrantDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import {
  createEmptyBaseEquipment,
  createEmptyModifier,
  createEmptyRestrictions,
  createEmptyVariantEquipment,
  normalizeEquipmentForSubmit,
  resolveCreateEquipmentSystemId
} from '../equipmentAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'
const variantId = '00000000-0000-4000-8000-000000000002'
const nestedId = '00000000-0000-4000-8000-000000000003'

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

  it('creates editable variant equipment defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(variantId)

    const equipment = createEmptyVariantEquipment({ systemId: 'dnd-5e-srd' })

    expect(equipment).toMatchObject({
      id: variantId,
      category: 'VARIANT',
      parentEquipmentId: '',
      properties: []
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
      ...createEmptyVariantEquipment({ systemId: 'dnd-5e-srd' }),
      parentEquipmentId: 'equipment-base-1'
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

  it('uses only real system list data when creating equipment', () => {
    expect(resolveCreateEquipmentSystemId([])).toBeNull()
    expect(resolveCreateEquipmentSystemId([{ id: 'dnd-5e-srd' }])).toBe('dnd-5e-srd')
  })

  it('creates schema-valid restriction and modifier editor defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(nestedId)

    expect(facetDtoSchema.parse(createEmptyRestrictions())).toMatchObject({
      id: nestedId,
      groups: []
    })
    expect(modifierGrantDtoSchema.parse(createEmptyModifier(2))).toMatchObject({
      id: nestedId,
      order: 2,
      grantKind: 'MODIFIER_GRANT',
      valueDomainCode: 'HIT_POINTS_MAX',
      modifierKind: 'BONUS'
    })
  })
})
