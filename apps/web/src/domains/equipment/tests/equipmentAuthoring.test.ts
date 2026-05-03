import {
  describe,
  expect,
  it,
  vi,
  afterEach } from 'vitest'
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

describe('equipment authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates editable base equipment defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-id')

    const equipment = createEmptyBaseEquipment({ systemId: 'dnd-5e-srd' })

    expect(equipment).toMatchObject({
      kind: 'EQUIPMENT',
      id: 'generated-id',
      label: '',
      status: 'DRAFT',
      category: 'ADVENTURING_GEAR',
      properties: [],
      systemId: 'dnd-5e-srd'
    })
  })

  it('creates editable variant equipment defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('variant-id')

    const equipment = createEmptyVariantEquipment({ systemId: 'dnd-5e-srd' })

    expect(equipment).toMatchObject({
      id: 'variant-id',
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
      description: ''
    })

    expect(normalized).toMatchObject({
      label: 'Untitled Equipment',
      category: 'ADVENTURING_GEAR',
      properties: [],
      weight: {
        amount: 0,
        unit: 'POUNDS'
      }
    })
    expect(normalized).not.toHaveProperty('userId')
  })

  it('uses only real system list data when creating equipment', () => {
    expect(resolveCreateEquipmentSystemId([])).toBeNull()
    expect(resolveCreateEquipmentSystemId([{ id: 'dnd-5e-srd' }])).toBe('dnd-5e-srd')
  })

  it('creates schema-valid restriction and modifier editor defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-nested-id')

    expect(facetDtoSchema.parse(createEmptyRestrictions())).toMatchObject({
      id: 'generated-nested-id',
      groups: []
    })
    expect(modifierGrantDtoSchema.parse(createEmptyModifier(2))).toMatchObject({
      id: 'generated-nested-id',
      order: 2,
      grantKind: 'MODIFIER_GRANT',
      valueDomainCode: 'HIT_POINTS_MAX',
      modifierKind: 'BONUS'
    })
  })
})
