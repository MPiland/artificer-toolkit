import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBaseRace, normalizeRaceForSubmit } from '../raceAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

describe('race authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates editable base race drafts', () => {
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
  })

  it('normalizes category-specific payloads before save', () => {
    const base = createEmptyBaseRace({ systemId: 'dnd-5e-srd' })
    const subrace = {
      id: generatedId,
      label: '',
      quote: '',
      description: '',
      status: 'DRAFT' as const,
      category: 'SUBRACE' as const,
      parentRaceId: '',
      details: [],
      features: [],
      systemId: 'dnd-5e-srd'
    }

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
})
