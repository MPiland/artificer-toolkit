import { describe, expect, it } from 'vitest'
import { loadEffectReferenceData, type EffectReferenceApi } from './referenceData'

const permissions = {
  canView: true,
  canEdit: true,
  canCopy: true,
  canDelete: true
}

const provenance = {
  kind: 'OWNED' as const,
  ownerUserId: 'user-1'
}

function createEffectReferenceApi(): EffectReferenceApi {
  return {
    systems: {
      list: async () => [
        { id: 'system-a', label: 'System A', userId: 'user-1' },
        { id: 'system-b', label: 'System B', userId: 'user-1' }
      ],
      get: async (id: string) => ({
        id,
        label: id === 'system-b' ? 'System B' : 'System A',
        alignments: [],
        conditionTypes: [{ id: `${id}-condition`, label: `${id} Condition` }],
        currencies: [],
        damageTypes: [{ id: `${id}-damage`, label: `${id} Damage` }],
        heritages: [],
        languages: [],
        lifestyles: [],
        magicSchools: [],
        passives: [],
        rarities: [],
        senses: [],
        skills: [],
        speeds: [],
        terrains: [],
        userId: 'user-1'
      })
    },
    content: {
      creatures: {
        list: async () => ({
          items: [
            {
              id: 'creature-a',
              label: 'Creature A',
              description: null,
              status: 'ACTIVE',
              userId: 'user-1',
              systemId: 'system-a',
              provenance,
              permissions
            },
            {
              id: 'creature-b',
              label: 'Creature B',
              description: null,
              status: 'ACTIVE',
              userId: 'user-1',
              systemId: 'system-b',
              provenance,
              permissions
            }
          ],
          meta: {}
        })
      }
    }
  }
}

describe('effect reference data', () => {
  it('loads vocabulary and creature options for the requested system', async () => {
    const references = await loadEffectReferenceData('system-b', createEffectReferenceApi())

    expect(references.systemId).toBe('system-b')
    expect(references.damageTypes).toEqual([{ value: 'system-b-damage', label: 'system-b Damage' }])
    expect(references.conditionTypes).toEqual([{ value: 'system-b-condition', label: 'system-b Condition' }])
    expect(references.creatures).toEqual([{ value: 'creature-b', label: 'Creature B' }])
  })
})
