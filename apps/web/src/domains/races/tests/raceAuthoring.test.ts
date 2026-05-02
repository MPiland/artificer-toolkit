import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyAncestry,
  createEmptyAncestryOption,
  createEmptyBaseRace,
  createEmptyDetail,
  createEmptyFeature,
  createEmptySubrace,
  normalizeRaceForSubmit,
  resolveCreateRaceSystemId,
  upsertById
} from '../raceAuthoring.utils'

describe('race authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates editable base race and subrace drafts', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-id')

    expect(createEmptyBaseRace({ systemId: 'dnd-5e-srd', userId: 'user-1' })).toMatchObject({
      id: 'generated-id',
      label: '',
      status: 'DRAFT',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      userId: 'user-1',
      systemId: 'dnd-5e-srd'
    })
    expect(createEmptySubrace({ systemId: 'dnd-5e-srd', userId: 'user-1' })).toMatchObject({
      id: 'generated-id',
      label: '',
      status: 'DRAFT',
      category: 'SUBRACE',
      parentRaceId: '',
      userId: 'user-1',
      systemId: 'dnd-5e-srd'
    })
  })

  it('uses only real system list data when creating races', () => {
    expect(resolveCreateRaceSystemId([])).toBeNull()
    expect(resolveCreateRaceSystemId([{ id: 'dnd-5e-srd' }])).toBe('dnd-5e-srd')
  })

  it('normalizes category-specific payloads before save', () => {
    const base = createEmptyBaseRace({ systemId: 'dnd-5e-srd', userId: 'user-1' })
    const subrace = createEmptySubrace({ systemId: 'dnd-5e-srd', userId: 'user-1' })

    expect(normalizeRaceForSubmit({
      ...base,
      label: '  ',
      category: 'BASE'
    })).toMatchObject({
      label: 'Untitled Race',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: base.speeds
    })
    expect(normalizeRaceForSubmit({
      ...subrace,
      label: ' Wood Elf ',
      category: 'SUBRACE',
      parentRaceId: 'elf',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: []
    })).toEqual({
      id: subrace.id,
      label: 'Wood Elf',
      quote: '',
      description: '',
      status: 'DRAFT',
      category: 'SUBRACE',
      parentRaceId: 'elf',
      details: [],
      features: [],
      userId: 'user-1',
      systemId: 'dnd-5e-srd'
    })
  })

  it('creates valid nested defaults and upserts by id', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-id')

    expect(createEmptyDetail(1)).toMatchObject({ id: 'generated-id', order: 1 })
    expect(createEmptyFeature(2)).toMatchObject({ id: 'generated-id', order: 2 })
    expect(createEmptyAncestry()).toMatchObject({ id: 'generated-id', options: [] })
    expect(createEmptyAncestryOption(3)).toMatchObject({ id: 'generated-id', order: 3, features: [] })

    const original = createEmptyFeature(1)
    const updated = { ...original, label: 'Fleet of Foot' }

    expect(upsertById([], original)).toEqual([original])
    expect(upsertById([original], updated)).toEqual([updated])
  })
})
