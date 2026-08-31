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
        {
          id: 'system-a',
          label: 'System A',
          rulesetCode: 'dnd5e',
          rulesetVersion: '2014',
          userId: 'user-1',
          rulesCatalogues: []
        },
        {
          id: 'system-b',
          label: 'System B',
          rulesetCode: 'dnd5e',
          rulesetVersion: '2014',
          userId: 'user-1',
          rulesCatalogues: []
        }
      ],
      get: async (id: string) => ({
        id,
        label: id === 'system-b' ? 'System B' : 'System A',
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
        alignments: [],
        challengeRatings: [],
        conditionTypes: [
          { id: `${id}-condition`, code: `${id}-condition`, label: `${id} Condition` }
        ],
        creatureTypes: [],
        currencies: [],
        damageTypes: [{ id: `${id}-damage`, code: `${id}-damage`, label: `${id} Damage` }],
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
              publicId: 'creature-a',
              activeUpdatedAt: '2026-01-01T00:00:00.000Z',
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
              publicId: 'creature-b',
              activeUpdatedAt: '2026-01-01T00:00:00.000Z',
              label: 'Creature B',
              description: null,
              status: 'ACTIVE',
              userId: 'user-1',
              systemId: 'system-b',
              provenance,
              permissions
            }
          ],
          drafts: [],
          meta: {},
          page: { nextCursor: null, previousCursor: null, totalCount: 2 },
          summary: { activeCount: 2, masterCount: 0, ownedCount: 2 }
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
    expect(references.conditionTypes).toEqual([
      { value: 'system-b-condition', label: 'system-b Condition' }
    ])
    expect(references.creatures).toEqual([{ value: 'creature-b', label: 'Creature B' }])
  })
})
