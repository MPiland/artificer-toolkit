import { describe, expect, it, vi } from 'vitest'
import {
  createEmptyClass,
  createEmptyMulticlass,
  normalizeClassForSubmit
} from '../classAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

describe('class authoring utilities', () => {
  it('creates draft-safe empty classes without forcing a category', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    expect(createEmptyClass({ systemId: 'system-1' })).toMatchObject({
      id: generatedId,
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
      category: 'BASE',
      subclassSelectionLevel: 3
    })
    const subclass = normalizeClassForSubmit({
      ...createEmptyClass({ systemId: 'system-1' }),
      label: ' Champion ',
      category: 'SUBCLASS',
      subclassSelectionLevel: undefined,
      parentClassId: 'fighter'
    })

    expect(baseClass).toMatchObject({
      label: 'Fighter',
      category: 'BASE',
      subclassSelectionLevel: 3,
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
      subclassSelectionLevel: undefined,
      parentClassId: '   '
    })

    expect(subclass).toMatchObject({
      label: 'Champion',
      category: 'SUBCLASS'
    })
    expect(subclass).not.toHaveProperty('parentClassId')
  })

  it('creates nested row defaults for common class groups', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    expect(createEmptyMulticlass()).toMatchObject({
      id: generatedId,
      requirementGroups: { groups: [] }
    })
  })
})
