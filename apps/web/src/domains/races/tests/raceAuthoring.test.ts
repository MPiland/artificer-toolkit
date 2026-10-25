import { afterEach, describe, expect, it, vi } from 'vitest'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { createEmptyBaseRace, normalizeRaceForSubmit } from '../raceAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

describe('race authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates editable base race drafts', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    expect(createEmptyBaseRace({ systemId: DND5E_SYSTEM_ID })).toMatchObject({
      id: generatedId,
      label: '',
      status: 'DRAFT',
      category: 'BASE',
      selectionMode: 'DIRECT',
      size: 'MEDIUM',
      systemId: DND5E_SYSTEM_ID
    })
  })

  it('normalizes category-specific payloads before save', () => {
    const base = createEmptyBaseRace({ systemId: DND5E_SYSTEM_ID })
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
      systemId: DND5E_SYSTEM_ID
    }

    expect(
      normalizeRaceForSubmit({
        ...base,
        label: '  ',
        category: 'BASE'
      })
    ).toMatchObject({
      label: '',
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
      systemId: DND5E_SYSTEM_ID
    })
  })
})
