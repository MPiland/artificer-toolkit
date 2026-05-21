import { beforeEach, describe, expect, it, vi } from 'vitest'

const wrapperCalls: string[] = []

vi.mock('../domains/index.js', () => {
  const track = (name: string) => vi.fn(async () => {
    wrapperCalls.push(name)
  })

  return {
    upsertBackground: track('upsertBackground'),
    upsertCharge: track('upsertCharge'),
    upsertClass: track('upsertClass'),
    upsertDetail: track('upsertDetail'),
    upsertEffect: track('upsertEffect'),
    upsertEquipment: track('upsertEquipment'),
    upsertFeat: track('upsertFeat'),
    upsertFeatGrant: track('upsertFeatGrant'),
    upsertFeature: track('upsertFeature'),
    upsertModifierGrant: track('upsertModifierGrant'),
    upsertOption: track('upsertOption'),
    upsertProficiencyGrant: track('upsertProficiencyGrant'),
    upsertRace: track('upsertRace'),
    upsertSavingThrow: track('upsertSavingThrow'),
    upsertSenseGrant: track('upsertSenseGrant'),
    upsertSpell: track('upsertSpell'),
    upsertSpellGrant: track('upsertSpellGrant'),
    upsertStartingEquipment: track('upsertStartingEquipment'),
    upsertSystem: track('upsertSystem')
  }
})

import { seedBaselineContent } from '../seed/baseline.js'
import { defineBaselineContentBundle } from '../source-data/content.js'

describe('seedBaselineContent', () => {
  beforeEach(() => {
    wrapperCalls.length = 0
  })

  it('seeds systems before system-scoped content and returns counts', async () => {
    const bundle = defineBaselineContentBundle({
      vocabulary: {
        systems: [
          {
            id: 'system-1',
            label: 'System',
            description: null,
            alignments: [],
            challengeRatings: [],
            conditionTypes: [],
            creatureTypes: [],
            currencies: [],
            damageTypes: [],
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
          }
        ]
      },
      shared: {
        charges: [{ id: 'charge-1', scalingKind: 'NONE', resetKind: 'LONG_REST', limitKind: 'FIXED_AMOUNT', amount: 1 }],
        details: [{ id: 'detail-1', label: 'Detail', description: 'Description', order: 1 }],
        savingThrows: [{ id: 'save-1', ability: 'DEXTERITY', dcMethod: 'FIXED_DC', baseDc: 14 }],
        startingEquipment: [{ id: 'se-1', sets: [] }]
      },
      effects: {
        effects: []
      },
      features: {
        features: [],
        options: []
      },
      grants: {
        feats: [],
        modifiers: [],
        proficiencies: [],
        senses: [],
        spells: []
      },
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [],
        equipment: [],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    })

    const result = await seedBaselineContent({ db: {} as never, systemId: 'system-1' }, bundle)

    expect(wrapperCalls).toEqual([
      'upsertSystem',
      'upsertDetail',
      'upsertCharge',
      'upsertSavingThrow',
      'upsertStartingEquipment'
    ])
    expect(result).toEqual({
      systems: 1,
      sharedRecords: 4,
      effects: 0,
      features: 0,
      grants: 0,
      subjects: 0
    })
  })

  it('throws when the requested system is missing from the bundle', async () => {
    const bundle = defineBaselineContentBundle({
      vocabulary: {
        systems: []
      },
      shared: {
        charges: [],
        details: [],
        savingThrows: [],
        startingEquipment: []
      },
      effects: {
        effects: []
      },
      features: {
        features: [],
        options: []
      },
      grants: {
        feats: [],
        modifiers: [],
        proficiencies: [],
        senses: [],
        spells: []
      },
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [],
        equipment: [],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    })

    await expect(
      seedBaselineContent({ db: {} as never, systemId: 'missing-system' }, bundle)
    ).rejects.toThrow('Missing system seed record')
  })
})


