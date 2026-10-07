import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod/mini'
import { proficiencyGrantDtoSchema } from '@artificer-toolkit/schema/grants'
import {
  createEmptyClass,
  createEmptyDetail,
  createEmptyFeature,
  createEmptyMulticlass,
  createEmptyProficiency,
  createEmptySpecialization,
  normalizeClassForSubmit,
  resolveClassEditReadOnly,
  resolveCreateClassSystemId
} from '../classAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

describe('class authoring utilities', () => {
  it('creates an empty proficiency grant that satisfies the grant contract', () => {
    expect(z.safeParse(proficiencyGrantDtoSchema, createEmptyProficiency(0)).success).toBe(true)
  })

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

    expect(createEmptyDetail(1)).toMatchObject({ id: generatedId, order: 1 })
    expect(createEmptyFeature(2)).toMatchObject({ id: generatedId, order: 2 })
    expect(createEmptySpecialization(3)).toMatchObject({ id: generatedId, order: 3 })
    expect(createEmptyMulticlass()).toMatchObject({
      id: generatedId,
      requirementGroups: { groups: [] }
    })
  })

  it('requires a real system id for create mode', () => {
    expect(resolveCreateClassSystemId([{ id: 'system-1' }])).toBe('system-1')
    expect(resolveCreateClassSystemId([])).toBeNull()
  })

  it('keeps locked active classes read-only even when a draft row exists', () => {
    expect(
      resolveClassEditReadOnly({
        canEdit: false,
        hasActiveClass: true
      })
    ).toBe(true)
    expect(
      resolveClassEditReadOnly({
        canEdit: false,
        hasActiveClass: false
      })
    ).toBe(false)
    expect(
      resolveClassEditReadOnly({
        canEdit: true,
        hasActiveClass: true
      })
    ).toBe(false)
  })
})
