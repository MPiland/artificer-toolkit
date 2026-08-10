import { describe, expect, it, vi } from 'vitest'

import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'
import { buildCharacterSheetResponse } from './sheetProjection.js'

const mocks = vi.hoisted(() => ({
  runEngine: vi.fn()
}))

vi.mock('@artificer-toolkit/shared/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/shared/core')>()
  return {
    ...actual,
    runEngine: mocks.runEngine
  }
})

function createCharacter(): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    status: 'ACTIVE',
    profile: {},
    systemId: 'dnd5e2014',
    userId: 'user-1',
    intent: {
      advancement: { method: 'MILESTONE' },
      race: { raceId: 'race-1' },
      background: { backgroundId: 'background-1' },
      classes: [
        { classId: 'class-1', classLevel: 2 },
        { classId: 'class-2', classLevel: 1 }
      ],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [{ ability: 'DEXTERITY', option: '14' }]
      },
      hitpoints: {
        method: 'FIXED',
        levels: [
          { level: 1, classId: 'class-1', classLevel: 1, value: 10 },
          { level: 2, classId: 'class-2', classLevel: 1, value: 7 },
          { level: 3, classId: 'class-1', classLevel: 2, value: 6 }
        ]
      },
      featureAcquisitions: [
        {
          id: 'feat-acquisition-1',
          featureId: 'feat-1',
          source: { kind: 'FEAT', featId: 'feat-1' },
          timing: { kind: 'IMMEDIATE' }
        }
      ],
      spellSelections: [
        {
          id: 'spell-selection-1',
          source: { kind: 'CLASS', classId: 'class-1' },
          timing: { kind: 'IMMEDIATE' },
          spells: ['spell-1']
        }
      ]
    },
    state: {
      equipment: { inventory: [], equipped: [], attuned: [] },
      currency: [],
      hitpoints: { current: 23, hitDice: [] }
    }
  }
}

function createResolution(): CharacterBuilderResolution {
  return {
    mode: 'edit',
    catalog: {
      races: [{ id: 'race-1', label: 'Human', category: 'BASE' }],
      classes: [
        { id: 'class-1', label: 'Fighter', category: 'BASE' },
        { id: 'class-2', label: 'Rogue', category: 'BASE' }
      ],
      backgrounds: [
        {
          id: 'background-1',
          label: 'Sage',
          summary: '',
          grantFacts: [],
          featureLabels: [],
          hiddenGrantFactCount: 0,
          hiddenFeatureCount: 0
        }
      ],
      equipment: [],
      feats: [{ id: 'feat-1', label: 'Alert' }],
      spells: [
        {
          id: 'spell-1',
          label: 'Magic Missile',
          description: '',
          castingTime: { unit: 'ROUND', amount: 1 },
          level: 1,
          classIds: ['class-1'],
          magicSchoolId: 'EVOCATION'
        }
      ]
    },
    registry: {
      system: {
        id: 'dnd5e2014',
        label: 'D&D 5e 2014',
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
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
      },
      races: [
        {
          id: 'race-1',
          label: 'Human',
          category: 'BASE',
          selectionMode: 'DIRECT',
          size: 'MEDIUM',
          speeds: [{ speedId: 'WALKING', amount: 30, unit: 'FEET' }],
          userId: 'user-1',
          systemId: 'system-1'
        }
      ],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [
        {
          id: 'feat-1',
          label: 'Alert',
          description: '',
          userId: 'user-1',
          systemId: 'system-1'
        }
      ],
      features: []
    },
    summary: {
      totalLevel: 3,
      abilities: { DEXTERITY: 14 },
      classes: []
    },
    grants: { features: [], resources: [], spellcasting: [] },
    chosenGrantChoices: [],
    outstandingChoices: [],
    validations: [],
    readiness: { ready: true, blockingIssues: [], outstandingRequiredChoices: [] },
    recommendedSectionId: 'REVIEW'
  }
}

function createEmptyQuery() {
  const query = {
    innerJoin: () => query,
    leftJoin: () => query,
    select: () => query,
    where: () => query,
    orderBy: () => query,
    execute: async () => []
  }
  return query
}

const db = {
  selectFrom: () => createEmptyQuery()
}

describe('MVP character Builder-to-engine completeness', () => {
  it('passes race, feat, and ordered multiclass hitpoint data without hydrating spell aggregates', async () => {
    mocks.runEngine.mockImplementation((snapshot, registry) => {
      expect(snapshot).toMatchObject({
        raceId: 'race-1',
        hitpoints: [
          { classId: 'class-1', classLevel: 1, value: 10 },
          { classId: 'class-2', classLevel: 1, value: 7 },
          { classId: 'class-1', classLevel: 2, value: 6 }
        ]
      })
      expect(registry.races).toHaveProperty('race-1')
      expect(registry.feats).toHaveProperty('feat-1')
      expect(registry.spells).toEqual({})
      return {
        characterId: 'character-1',
        systemId: 'system-1',
        defenses: [],
        proficiencies: [],
        senses: [],
        derivedStats: {
          proficiencyBonus: 2,
          abilityScores: { DEXTERITY: 14 },
          abilityModifiers: { DEXTERITY: 2 },
          savingThrows: {},
          skillBonuses: {},
          skillGoverningAbilities: {},
          passiveChecks: {},
          movementSpeeds: [],
          initiative: 2,
          armorClass: 12,
          maxHitPoints: 23
        },
        calculations: {
          proficiencyBonus: { base: 2, contributions: [], effective: 2 },
          abilityScores: {},
          abilityModifiers: {},
          savingThrowProficiencyLevels: {},
          savingThrows: {},
          skillGoverningAbilities: {},
          skillProficiencyLevels: {},
          skillBonuses: {},
          passiveChecks: {},
          movementSpeeds: {},
          senseRanges: {},
          initiative: { base: 2, contributions: [], effective: 2 },
          armorClass: { base: 12, contributions: [], effective: 12 },
          maxHitPoints: { base: 23, contributions: [], effective: 23 }
        },
        rollModes: {
          initiative: 'NORMAL',
          abilityChecks: {
            CHARISMA: 'NORMAL',
            CONSTITUTION: 'NORMAL',
            DEXTERITY: 'NORMAL',
            INTELLIGENCE: 'NORMAL',
            STRENGTH: 'NORMAL',
            WISDOM: 'NORMAL'
          },
          savingThrows: {
            CHARISMA: 'NORMAL',
            CONSTITUTION: 'NORMAL',
            DEXTERITY: 'NORMAL',
            INTELLIGENCE: 'NORMAL',
            STRENGTH: 'NORMAL',
            WISDOM: 'NORMAL'
          },
          skillChecks: {},
          attacks: {
            MELEE: 'NORMAL',
            RANGED: 'NORMAL',
            SPELL: 'NORMAL',
            UNARMED: 'NORMAL'
          }
        },
        spellSlots: { maxByLevel: {}, fusionStrategy: 'NONE' },
        spellAccess: [],
        resources: [],
        spellMechanics: [],
        itemMechanics: [],
        equipmentFeatureChargeUses: [],
        companions: [],
        activeItemContributions: []
      }
    })

    await expect(
      buildCharacterSheetResponse({
        db: db as unknown as import('@artificer-toolkit/db').DBLike,
        character: createCharacter(),
        resolution: createResolution(),
        streamVersion: 1
      })
    ).resolves.toBeDefined()
  })
})
