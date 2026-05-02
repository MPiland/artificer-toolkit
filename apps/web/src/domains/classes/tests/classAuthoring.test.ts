import { describe, expect, it, vi } from 'vitest'
import {
  createEmptyClass,
  createEmptyDetail,
  createEmptyFeature,
  createEmptyMulticlass,
  createEmptySpecialization,
  normalizeClassForSubmit,
  resolveCreateClassSystemId
} from '../classAuthoring.utils'

describe('class authoring utilities', () => {
  it('creates draft-safe empty classes without forcing a category', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-id')

    expect(createEmptyClass({ systemId: 'system-1' })).toMatchObject({
      id: 'generated-id',
      label: '',
      status: 'DRAFT',
      systemId: 'system-1',
      details: [],
      proficiencies: [],
      features: []
    })
    expect(createEmptyClass({ systemId: 'system-1' }).category).toBeUndefined()
  })

  it('normalizes base and subclass activation payloads from the same form values', () => {
    const baseClass = normalizeClassForSubmit({
      ...createEmptyClass({ systemId: 'system-1' }),
      label: ' Fighter ',
      category: 'BASE'
    })
    const subclass = normalizeClassForSubmit({
      ...createEmptyClass({ systemId: 'system-1' }),
      label: ' Champion ',
      category: 'SUBCLASS',
      parentClassId: 'fighter'
    })

    expect(baseClass).toMatchObject({
      label: 'Fighter',
      category: 'BASE',
      startingGold: expect.any(Object),
      startingEquipment: expect.any(Object),
      hitpoint: expect.any(Object),
      multiclass: expect.any(Object)
    })
    expect(subclass).toMatchObject({
      label: 'Champion',
      category: 'SUBCLASS',
      parentClassId: 'fighter',
      specializations: []
    })
    expect(subclass).not.toHaveProperty('startingEquipment')
  })

  it('does not coerce missing subclass parent ids to empty strings', () => {
    const subclass = normalizeClassForSubmit({
      ...createEmptyClass({ systemId: 'system-1' }),
      label: 'Champion',
      category: 'SUBCLASS',
      parentClassId: '   '
    })

    expect(subclass).toMatchObject({
      label: 'Champion',
      category: 'SUBCLASS'
    })
    expect(subclass).not.toHaveProperty('parentClassId')
  })

  it('creates nested row defaults for common class groups', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-id')

    expect(createEmptyDetail(1)).toMatchObject({ id: 'generated-id', order: 1 })
    expect(createEmptyFeature(2)).toMatchObject({ id: 'generated-id', order: 2 })
    expect(createEmptySpecialization(3)).toMatchObject({ id: 'generated-id', order: 3 })
    expect(createEmptyMulticlass()).toMatchObject({ id: 'generated-id', requirementGroups: { groups: [] } })
  })

  it('requires a real system id for create mode', () => {
    expect(resolveCreateClassSystemId([{ id: 'system-1' }])).toBe('system-1')
    expect(resolveCreateClassSystemId([])).toBeNull()
  })
})
