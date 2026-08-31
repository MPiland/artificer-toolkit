import { describe, expect, it } from 'vitest'
import { loadAuthoredContentReferenceData } from './contentReferences'

const permissions = {
  canView: true,
  canEdit: true,
  canCopy: true,
  canDelete: true
}

const provenance = {
  kind: 'MASTER' as const,
  ownerUserId: null
}

function createReferenceApi(): NonNullable<Parameters<typeof loadAuthoredContentReferenceData>[1]> {
  return {
    systems: {
      list: async () => [
        {
          id: 'system-1',
          label: 'System 1',
          rulesetCode: 'dnd5e',
          rulesetVersion: '2014',
          userId: 'master',
          rulesCatalogues: []
        }
      ],
      get: async () => ({
        id: 'system-1',
        label: 'System 1',
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
        alignments: [],
        challengeRatings: [{ id: 'cr-1', code: 'ONE', label: '1' }],
        conditionTypes: [],
        creatureTypes: [{ id: 'type-dragon', code: 'DRAGON', label: 'Dragon' }],
        currencies: [],
        damageTypes: [],
        heritages: [],
        languages: [],
        lifestyles: [],
        magicSchools: [{ id: 'school-evocation', code: 'EVOCATION', label: 'Evocation' }],
        passives: [],
        rarities: [{ id: 'rarity-common', code: 'COMMON', label: 'Common' }],
        senses: [],
        skills: [],
        speeds: [{ id: 'speed-walk', code: 'WALK', label: 'Walking Speed' }],
        terrains: [],
        userId: 'master'
      })
    },
    content: {
      classes: {
        list: async () => ({
          items: [listItem('class-wizard', 'Wizard', 'system-1')],
          drafts: [],
          meta: {},
          page: { nextCursor: null, previousCursor: null, totalCount: 1 },
          summary: { activeCount: 1, masterCount: 1, ownedCount: 0 }
        })
      },
      creatures: {
        list: async () => ({
          items: [listItem('creature-dragon', 'Dragon', 'system-1')],
          drafts: [],
          meta: {},
          page: { nextCursor: null, previousCursor: null, totalCount: 1 },
          summary: { activeCount: 1, masterCount: 1, ownedCount: 0 }
        })
      },
      equipment: {
        list: async () => ({
          items: [listItem('equipment-backpack', 'Backpack', 'system-1')],
          drafts: [],
          meta: {},
          page: { nextCursor: null, previousCursor: null, totalCount: 1 },
          summary: { activeCount: 1, masterCount: 1, ownedCount: 0 }
        })
      },
      races: {
        list: async () => ({
          items: [listItem('race-elf', 'Elf', 'system-1')],
          drafts: [],
          meta: {},
          page: { nextCursor: null, previousCursor: null, totalCount: 1 },
          summary: { activeCount: 1, masterCount: 1, ownedCount: 0 }
        })
      }
    }
  }
}

function listItem(id: string, label: string, systemId: string) {
  return {
    id,
    publicId: id,
    activeUpdatedAt: '2026-01-01T00:00:00.000Z',
    label,
    description: null,
    status: 'ACTIVE' as const,
    systemId,
    userId: 'master',
    provenance,
    permissions
  }
}

describe('content reference data', () => {
  it('loads shared vocabulary and authored content labels for a system', async () => {
    const references = await loadAuthoredContentReferenceData('system-1', createReferenceApi())

    expect(references.challengeRatings).toEqual([{ value: 'cr-1', label: '1' }])
    expect(references.creatureTypes).toEqual([{ value: 'type-dragon', label: 'Dragon' }])
    expect(references.magicSchools).toEqual([{ value: 'school-evocation', label: 'Evocation' }])
    expect(references.classes).toEqual([{ value: 'class-wizard', label: 'Wizard' }])
    expect(references.equipment).toEqual([{ value: 'equipment-backpack', label: 'Backpack' }])
    expect(references.races).toEqual([{ value: 'race-elf', label: 'Elf' }])
    expect(references.speeds).toEqual([{ value: 'speed-walk', label: 'Walking Speed' }])
  })
})
