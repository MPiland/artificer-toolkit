import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { characterSheetFixture, dnd5e2014ExhaustionDescription } from './characterSheet.fixtures'

export const characterSheetMulticlassFixture = {
  ...characterSheetFixture,
  publicId: 'character-multiclass-fixture',
  meta: {
    ...characterSheetFixture.meta,
    characterId: 'character-multiclass-fixture',
    streamVersion: 3
  },
  identity: {
    label: 'Rook Arden',
    description: '<p>A temple guard who learned to survive by moving quietly.</p>',
    classSummary: 'Fighter 2 / Rogue 1',
    raceLabel: 'Human',
    backgroundLabel: 'Acolyte',
    totalLevel: 3
  },
  overview: {
    ...characterSheetFixture.overview,
    abilities: [
      {
        ability: 'STRENGTH',
        label: 'Strength',
        short: 'STR',
        score: 10,
        modifier: 0,
        rollMode: 'NORMAL'
      },
      {
        ability: 'DEXTERITY',
        label: 'Dexterity',
        short: 'DEX',
        score: 16,
        modifier: 3,
        rollMode: 'NORMAL'
      },
      {
        ability: 'CONSTITUTION',
        label: 'Constitution',
        short: 'CON',
        score: 14,
        modifier: 2,
        rollMode: 'NORMAL'
      },
      {
        ability: 'INTELLIGENCE',
        label: 'Intelligence',
        short: 'INT',
        score: 10,
        modifier: 0,
        rollMode: 'NORMAL'
      },
      {
        ability: 'WISDOM',
        label: 'Wisdom',
        short: 'WIS',
        score: 13,
        modifier: 1,
        rollMode: 'NORMAL'
      },
      {
        ability: 'CHARISMA',
        label: 'Charisma',
        short: 'CHA',
        score: 12,
        modifier: 1,
        rollMode: 'NORMAL'
      }
    ],
    facts: [
      { label: 'Speed', value: '30 feet' },
      { label: 'Passive Perception', value: '13' },
      { label: 'Passive Investigation', value: '10' },
      { label: 'Passive Insight', value: '13' }
    ],
    armorClass: 15,
    initiative: 3,
    currentHitPoints: 20,
    maxHitPoints: 26,
    tempHitPoints: 0,
    deathSaves: { successes: 0, failures: 0, stable: false },
    maxHitPointsModifier: -2,
    maxHitPointsModifierAdjustmentId: '11111111-1111-4111-8111-111111111112',
    maxHitPointsReductions: [],
    activeGrants: [],
    standingEffects: [],
    concentration: null,
    exhaustion: {
      label: 'Exhaustion',
      description: dnd5e2014ExhaustionDescription,
      level: 0,
      minimumLevel: 0,
      maximumLevel: 6
    },
    conditions: [],
    hitDice: [
      { die: 10, total: 2, used: 1, remaining: 1 },
      { die: 8, total: 1, used: 0, remaining: 1 }
    ],
    savingThrows: [
      {
        ability: 'STRENGTH',
        label: 'Strength',
        short: 'STR',
        total: 2,
        proficiency: 'FULL',
        rollMode: 'NORMAL'
      },
      {
        ability: 'DEXTERITY',
        label: 'Dexterity',
        short: 'DEX',
        total: 3,
        proficiency: 'NONE',
        rollMode: 'NORMAL'
      },
      {
        ability: 'CONSTITUTION',
        label: 'Constitution',
        short: 'CON',
        total: 4,
        proficiency: 'FULL',
        rollMode: 'NORMAL'
      },
      {
        ability: 'INTELLIGENCE',
        label: 'Intelligence',
        short: 'INT',
        total: 0,
        proficiency: 'NONE',
        rollMode: 'NORMAL'
      },
      {
        ability: 'WISDOM',
        label: 'Wisdom',
        short: 'WIS',
        total: 1,
        proficiency: 'NONE',
        rollMode: 'NORMAL'
      },
      {
        ability: 'CHARISMA',
        label: 'Charisma',
        short: 'CHA',
        total: 1,
        proficiency: 'NONE',
        rollMode: 'NORMAL'
      }
    ],
    skills: characterSheetFixture.overview.skills.map((skill) => {
      const resolved = {
        ACROBATICS: { total: 5, proficiency: 'FULL' as const },
        ATHLETICS: { total: 2, proficiency: 'FULL' as const },
        INSIGHT: { total: 3, proficiency: 'FULL' as const },
        PERCEPTION: { total: 3, proficiency: 'FULL' as const },
        RELIGION: { total: 2, proficiency: 'FULL' as const },
        SLEIGHT_OF_HAND: { total: 5, proficiency: 'FULL' as const },
        STEALTH: { total: 7, proficiency: 'DOUBLE' as const }
      }[skill.code]

      return {
        ...skill,
        total:
          resolved?.total ??
          (
            {
              STRENGTH: 0,
              DEXTERITY: 3,
              CONSTITUTION: 2,
              INTELLIGENCE: 0,
              WISDOM: 1,
              CHARISMA: 1
            } as Record<string, number>
          )[skill.ability] ??
          0,
        proficiency: resolved?.proficiency ?? 'NONE'
      }
    })
  },
  actions: {
    items: [
      {
        id: 'equipment-shortsword:attack',
        label: 'Shortsword',
        kind: 'ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Equipment',
        description: '<p>A quick finesse weapon suited to close combat.</p>',
        mechanic: {
          effectId: 'effect-shortsword-attack',
          trigger: 'ATTACK_ROLL',
          activation: { kind: 'ACTION', amount: 1 },
          rangeLabel: '5 ft',
          attackBonus: 5,
          outcomes: [
            {
              kind: 'DAMAGE',
              pathCode: 'ON_HIT',
              expression: '1d6 + 3',
              damageTypeId: 'piercing',
              damageTypeLabel: 'Piercing'
            }
          ]
        }
      },
      {
        id: 'action-second-wind',
        label: 'Second Wind',
        kind: 'BONUS_ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Fighter',
        description: '<p>Regain 1d10 + 2 hit points.</p>',
        resourceGrantId: 'resource-second-wind'
      },
      {
        id: 'action-action-surge',
        label: 'Action Surge',
        kind: 'OTHER',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Fighter',
        description: '<p>Take one additional action on your turn.</p>',
        resourceGrantId: 'resource-action-surge'
      }
    ]
  },
  resources: {
    items: [
      {
        id: 'resource-second-wind',
        label: 'Second Wind',
        description: '<p>Regain 1d10 + 2 hit points as a bonus action.</p>',
        sourceLabel: 'Fighter',
        sourceFeatureId: 'feature:second-wind',
        owner: {
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-second-wind',
          source: {
            kind: 'AUTHORED',
            sourceKind: 'FEATURE',
            definitionId: '00000000-0000-4000-8000-000000000221',
            sourceInstanceId: 'feature:second-wind'
          }
        },
        used: 1,
        max: 1,
        remaining: 0,
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      },
      {
        id: 'resource-action-surge',
        label: 'Action Surge',
        description: '<p>Take one additional action on your turn.</p>',
        sourceLabel: 'Fighter',
        sourceFeatureId: 'feature:action-surge',
        owner: {
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-action-surge',
          source: {
            kind: 'AUTHORED',
            sourceKind: 'FEATURE',
            definitionId: '00000000-0000-4000-8000-000000000222',
            sourceInstanceId: 'feature:action-surge'
          }
        },
        used: 1,
        max: 1,
        remaining: 0,
        recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
      }
    ],
    hitDice: [
      { die: 10, total: 2, used: 1, remaining: 1 },
      { die: 8, total: 1, used: 0, remaining: 1 }
    ]
  },
  spells: {
    ...characterSheetFixture.spells,
    slots: [],
    activeGroups: [],
    spells: []
  },
  inventory: {
    items: [
      {
        id: 'inventory-shortsword',
        equipmentId: 'equipment-shortsword',
        label: 'Shortsword',
        description: '<p>A standard shortsword.</p>',
        category: 'WEAPON',
        properties: [
          { code: 'FINESSE', label: 'Finesse' },
          { code: 'LIGHT', label: 'Light' }
        ],
        weight: { amount: 2, unit: 'POUNDS' },
        quantity: 1,
        equippedSlot: 'MAIN_HAND',
        attuned: false,
        requiresAttunement: false
      },
      {
        id: 'inventory-thieves-tools',
        equipmentId: 'equipment-thieves-tools',
        label: "Thieves' Tools",
        description: '<p>Tools for picking locks and disarming traps.</p>',
        category: 'TOOL',
        quantity: 1,
        equippedSlot: null,
        attuned: false,
        requiresAttunement: false
      }
    ],
    currencies: [{ currencyId: 'gp', kind: 'RULESET', label: 'Gold', amount: 15 }]
  },
  reference: {
    ...characterSheetFixture.reference,
    features: [
      {
        id: 'feature-second-wind',
        label: 'Second Wind',
        description: '<p>Regain 1d10 + your fighter level hit points.</p>',
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'class-fighter', classLevel: 1 }
      },
      {
        id: 'feature-action-surge',
        label: 'Action Surge',
        description: '<p>Take one additional action on your turn.</p>',
        sourceLabel: 'Fighter',
        source: { kind: 'CLASS', classId: 'class-fighter', classLevel: 2 }
      },
      {
        id: 'feature-sneak-attack',
        label: 'Sneak Attack',
        description: '<p>Deal an extra 1d6 damage when you meet its conditions.</p>',
        sourceLabel: 'Rogue',
        source: { kind: 'CLASS', classId: 'class-rogue', classLevel: 1 }
      }
    ],
    proficiencies: [
      { kind: 'ARMOR', label: 'All Armor', value: 'Fighter - Proficient' },
      { kind: 'ARMOR', label: 'Shields', value: 'Fighter - Proficient' },
      { kind: 'WEAPON', label: 'Simple Weapons', value: 'Fighter - Proficient' },
      { kind: 'WEAPON', label: 'Martial Weapons', value: 'Fighter - Proficient' },
      { kind: 'TOOL', label: "Thieves' Tools", value: 'Rogue - Proficient' },
      { kind: 'LANGUAGE', label: 'Common', value: 'Human - Proficient' },
      { kind: 'LANGUAGE', label: 'Celestial', value: 'Acolyte - Proficient' },
      { kind: 'LANGUAGE', label: 'Elvish', value: 'Acolyte - Proficient' }
    ],
    defenses: [],
    senses: [],
    equipmentOptions: [
      {
        id: 'equipment-shortsword',
        label: 'Shortsword',
        isContainer: false,
        requiresAttunement: false
      },
      {
        id: 'equipment-thieves-tools',
        label: "Thieves' Tools",
        isContainer: false,
        requiresAttunement: false
      }
    ]
  },
  notes: {
    ...characterSheetFixture.notes,
    faith: 'The temple of Oghma',
    appearance: 'Travel-worn temple colors beneath practical armor.',
    organizations: 'Acolyte of the House of Knowledge.',
    backstory:
      '<p>Rook guarded a temple archive before learning that discretion could protect knowledge as effectively as steel.</p>'
  }
} satisfies CharacterSheetResponseDto
