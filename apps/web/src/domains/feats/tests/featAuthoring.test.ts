import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyFeat,
  normalizeFeatForSubmit,
  resolveCreateFeatSystemId
} from '../featAuthoring.utils'

const generatedId = '00000000-0000-4000-8000-000000000001'

describe('feat authoring helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a draft feat with editable defaults', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedId)

    const feat = createEmptyFeat({ systemId: 'dnd-5e-srd' })

    expect(feat).toMatchObject({
      id: generatedId,
      label: '',
      description: '',
      details: [],
      status: 'DRAFT',
      effects: [],
      features: [],
      systemId: 'dnd-5e-srd'
    })
  })

  it('uses only real system list data when creating feats', () => {
    expect(resolveCreateFeatSystemId([])).toBeNull()
    expect(resolveCreateFeatSystemId([{ id: 'dnd-5e-srd' }])).toBe('dnd-5e-srd')
  })

  it('normalizes missing optional collections before save', () => {
    const feat = createEmptyFeat({ systemId: 'dnd-5e-srd' })
    const normalized = normalizeFeatForSubmit({
      ...feat,
      label: '  ',
      description: '',
      details: undefined,
      effects: undefined,
      features: undefined,
      grants: {
        modifiers: [],
        proficiencies: [],
        senses: [],
        spells: [],
        feats: [
          {
            id: 'grant-feat',
            order: 1,
            grantKind: 'FEAT_GRANT',
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            featIds: ['grappler']
          }
        ]
      }
    })

    expect(normalized.label).toBe('Untitled Feat')
    expect(normalized.description).toBe('')
    expect(normalized.details).toEqual([])
    expect(normalized.effects).toEqual([])
    expect(normalized.features).toEqual([])
    expect(normalized.grants?.feats).toHaveLength(1)
  })
})
