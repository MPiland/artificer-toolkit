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

const generatedId = '00000000-0000-4000-8000-000000000001'

describe('race authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates editable base race and subrace drafts', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    expect(createEmptyBaseRace({ systemId: 'dnd-5e-srd' })).toMatchObject({
      id: generatedId,
      label: '',
      status: 'DRAFT',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      systemId: 'dnd-5e-srd'
    })
    expect(createEmptySubrace({ systemId: 'dnd-5e-srd' })).toMatchObject({
      id: generatedId,
      label: '',
      status: 'DRAFT',
      category: 'SUBRACE',
      parentRaceId: '',
      systemId: 'dnd-5e-srd'
    })
  })

  it('uses only real system list data when creating races', () => {
    expect(resolveCreateRaceSystemId([])).toBeNull()
    expect(resolveCreateRaceSystemId([{ id: 'dnd-5e-srd' }])).toBe('dnd-5e-srd')
  })

  it('normalizes category-specific payloads before save', () => {
    const base = createEmptyBaseRace({ systemId: 'dnd-5e-srd' })
    const subrace = createEmptySubrace({ systemId: 'dnd-5e-srd' })

    expect(
      normalizeRaceForSubmit({
        ...base,
        label: '  ',
        category: 'BASE'
      })
    ).toMatchObject({
      label: 'Untitled Race',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      speeds: base.speeds
    })
    expect(
      normalizeRaceForSubmit({
        ...subrace,
        label: ' Wood Elf ',
        category: 'SUBRACE',
        parentRaceId: 'elf',
        selectionMode: 'DIRECT',
        size: 'MEDIUM',
        speeds: []
      })
    ).toEqual({
      id: subrace.id,
      label: 'Wood Elf',
      quote: '',
      description: '',
      status: 'DRAFT',
      category: 'SUBRACE',
      parentRaceId: 'elf',
      details: [],
      features: [],
      systemId: 'dnd-5e-srd'
    })
  })

  it('creates valid nested defaults and upserts by id', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    expect(createEmptyDetail(1)).toMatchObject({ id: generatedId, order: 1 })
    expect(createEmptyFeature(2)).toMatchObject({ id: generatedId, order: 2 })
    expect(createEmptyAncestry()).toMatchObject({ id: generatedId, options: [] })
    expect(createEmptyAncestryOption(3)).toMatchObject({ id: generatedId, order: 3, features: [] })

    const original = createEmptyFeature(1)
    const updated = { ...original, label: 'Fleet of Foot' }

    expect(upsertById([], original)).toEqual([original])
    expect(upsertById([original], updated)).toEqual([updated])
  })
})
