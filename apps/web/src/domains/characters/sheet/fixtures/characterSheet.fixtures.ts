import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { characterFixture } from '../../builder/fixtures/characterBuilder.fixtures'

export const dnd5e2014ExhaustionDescription =
  '<p>Each exhaustion level includes the effects of every lower level.</p><ol><li><strong>Level 1:</strong> Disadvantage on ability checks.</li><li><strong>Level 2:</strong> Speed is halved.</li><li><strong>Level 3:</strong> Disadvantage on attack rolls and saving throws.</li><li><strong>Level 4:</strong> Hit point maximum is halved.</li><li><strong>Level 5:</strong> Speed is reduced to 0.</li><li><strong>Level 6:</strong> Death.</li></ol>'

export const characterSheetFixture = {
  publicId: 'character-owned',
  meta: {
    characterId: characterFixture.id,
    viewer: 'CHARACTER_OWNER',
    capabilities: {
      managePlayState: true,
      managePrivateNotes: true,
      manageInventory: true,
      openBuilder: true,
      endActiveEffects: false
    },
    systemId: characterFixture.systemId,
    status: AUTHORED_RECORD_STATUS.ACTIVE,
    streamVersion: 8
  },
  identity: {
    label: characterFixture.label,
    description: characterFixture.description,
    classSummary: 'Wizard 3',
    raceLabel: 'High Elf',
    backgroundLabel: 'Acolyte',
    totalLevel: 3
  },
  overview: {
    abilities: [
      {
        ability: 'STRENGTH',
        label: 'Strength',
        short: 'STR',
        score: 8,
        modifier: -1,
        rollMode: 'NORMAL'
      },
      {
        ability: 'DEXTERITY',
        label: 'Dexterity',
        short: 'DEX',
        score: 14,
        modifier: 2,
        rollMode: 'NORMAL'
      },
      {
        ability: 'CONSTITUTION',
        label: 'Constitution',
        short: 'CON',
        score: 13,
        modifier: 1,
        rollMode: 'NORMAL'
      },
      {
        ability: 'INTELLIGENCE',
        label: 'Intelligence',
        short: 'INT',
        score: 16,
        modifier: 3,
        rollMode: 'NORMAL'
      },
      {
        ability: 'WISDOM',
        label: 'Wisdom',
        short: 'WIS',
        score: 12,
        modifier: 1,
        rollMode: 'NORMAL'
      },
      {
        ability: 'CHARISMA',
        label: 'Charisma',
        short: 'CHA',
        score: 10,
        modifier: 0,
        rollMode: 'NORMAL'
      }
    ],
    facts: [
      { label: 'Speed', value: '30 feet' },
      { label: 'Passive Perception', value: '13' },
      { label: 'Passive Investigation', value: '13' },
      { label: 'Passive Insight', value: '11' }
    ],
    armorClass: 12,
    initiative: 2,
    initiativeRollMode: 'NORMAL',
    rollModes: [
      { code: 'NORMAL', label: 'Normal', keep: 'FIRST' },
      { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' },
      { code: 'DISADVANTAGE', label: 'Disadvantage', keep: 'LOWER' }
    ],
    proficiencyBonus: 2,
    currentHitPoints: 14,
    maxHitPoints: 17,
    tempHitPoints: 4,
    deathSaves: { successes: 0, failures: 0, stable: false },
    maxHitPointsOverride: null,
    maxHitPointsModifier: 0,
    maxHitPointsModifierAdjustmentId: null,
    maxHitPointsReductions: [],
    activeGrants: [],
    concentration: null,
    exhaustion: {
      label: 'Exhaustion',
      description: dnd5e2014ExhaustionDescription,
      level: 1,
      minimumLevel: 0,
      maximumLevel: 6,
      notes: 'Forced march through the drowned road.'
    },
    conditions: [
      {
        conditionTypeId: '00000000-0000-4000-8000-000000000601',
        label: 'Poisoned',
        description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
        notes: 'Spider venom, save at end of turn.'
      }
    ],
    hitDice: [{ die: 6, total: 3, used: 1, remaining: 2 }],
    savingThrows: [
      {
        ability: 'STRENGTH',
        label: 'Strength',
        short: 'STR',
        total: -1,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        ability: 'DEXTERITY',
        label: 'Dexterity',
        short: 'DEX',
        total: 2,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        ability: 'CONSTITUTION',
        label: 'Constitution',
        short: 'CON',
        total: 1,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        ability: 'INTELLIGENCE',
        label: 'Intelligence',
        short: 'INT',
        total: 5,
        rollMode: 'NORMAL',
        proficiency: 'FULL'
      },
      {
        ability: 'WISDOM',
        label: 'Wisdom',
        short: 'WIS',
        total: 3,
        rollMode: 'NORMAL',
        proficiency: 'FULL'
      },
      {
        ability: 'CHARISMA',
        label: 'Charisma',
        short: 'CHA',
        total: 0,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      }
    ],
    skills: [
      {
        skillId: 'acrobatics',
        code: 'ACROBATICS',
        label: 'Acrobatics',
        ability: 'DEXTERITY',
        abilityShort: 'DEX',
        total: 2,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'animal-handling',
        code: 'ANIMAL_HANDLING',
        label: 'Animal Handling',
        ability: 'WISDOM',
        abilityShort: 'WIS',
        total: 1,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'arcana',
        code: 'ARCANA',
        label: 'Arcana',
        ability: 'INTELLIGENCE',
        abilityShort: 'INT',
        total: 5,
        rollMode: 'NORMAL',
        proficiency: 'FULL'
      },
      {
        skillId: 'athletics',
        code: 'ATHLETICS',
        label: 'Athletics',
        ability: 'STRENGTH',
        abilityShort: 'STR',
        total: -1,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'deception',
        code: 'DECEPTION',
        label: 'Deception',
        ability: 'CHARISMA',
        abilityShort: 'CHA',
        total: 0,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'history',
        code: 'HISTORY',
        label: 'History',
        ability: 'INTELLIGENCE',
        abilityShort: 'INT',
        total: 5,
        rollMode: 'NORMAL',
        proficiency: 'FULL'
      },
      {
        skillId: 'insight',
        code: 'INSIGHT',
        label: 'Insight',
        ability: 'WISDOM',
        abilityShort: 'WIS',
        total: 1,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'intimidation',
        code: 'INTIMIDATION',
        label: 'Intimidation',
        ability: 'CHARISMA',
        abilityShort: 'CHA',
        total: 0,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'investigation',
        code: 'INVESTIGATION',
        label: 'Investigation',
        ability: 'INTELLIGENCE',
        abilityShort: 'INT',
        total: 3,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'medicine',
        code: 'MEDICINE',
        label: 'Medicine',
        ability: 'WISDOM',
        abilityShort: 'WIS',
        total: 1,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'nature',
        code: 'NATURE',
        label: 'Nature',
        ability: 'INTELLIGENCE',
        abilityShort: 'INT',
        total: 3,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'perception',
        code: 'PERCEPTION',
        label: 'Perception',
        ability: 'WISDOM',
        abilityShort: 'WIS',
        total: 3,
        rollMode: 'NORMAL',
        proficiency: 'FULL'
      },
      {
        skillId: 'performance',
        code: 'PERFORMANCE',
        label: 'Performance',
        ability: 'CHARISMA',
        abilityShort: 'CHA',
        total: 0,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'persuasion',
        code: 'PERSUASION',
        label: 'Persuasion',
        ability: 'CHARISMA',
        abilityShort: 'CHA',
        total: 0,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'religion',
        code: 'RELIGION',
        label: 'Religion',
        ability: 'INTELLIGENCE',
        abilityShort: 'INT',
        total: 3,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'sleight-of-hand',
        code: 'SLEIGHT_OF_HAND',
        label: 'Sleight of Hand',
        ability: 'DEXTERITY',
        abilityShort: 'DEX',
        total: 2,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'stealth',
        code: 'STEALTH',
        label: 'Stealth',
        ability: 'DEXTERITY',
        abilityShort: 'DEX',
        total: 2,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      },
      {
        skillId: 'survival',
        code: 'SURVIVAL',
        label: 'Survival',
        ability: 'WISDOM',
        abilityShort: 'WIS',
        total: 1,
        rollMode: 'NORMAL',
        proficiency: 'NONE'
      }
    ]
  },
  actions: {
    items: [
      {
        id: 'equipment-staff:attack',
        label: 'Quarterstaff',
        kind: 'ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Equipment',
        description: '<p>A sturdy staff marked with research notches and salt stains.</p>',
        mechanic: {
          effectId: 'effect-quarterstaff-attack',
          trigger: 'ATTACK_ROLL',
          activation: { kind: 'ACTION', amount: 1 },
          rangeLabel: '5 ft',
          attackBonus: 4,
          attackRollMode: 'NORMAL',
          outcomes: [
            {
              kind: 'DAMAGE',
              pathCode: 'ON_HIT',
              expression: '1d6 + 2',
              damageTypeId: 'bludgeoning',
              damageTypeLabel: 'Bludgeoning'
            }
          ]
        }
      },
      {
        id: 'action-trance',
        label: 'Trance',
        kind: 'OTHER',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'Elf',
        description: '<p>Meditate deeply instead of sleeping, remaining semiconscious.</p>'
      }
    ]
  },
  resources: {
    items: [
      {
        id: 'resource-arcane-recovery',
        label: 'Arcane Recovery',
        description:
          '<p>Recover spell slots with a combined level up to half your wizard level.</p>',
        sourceLabel: 'Wizard',
        sourceFeatureId: 'feature:arcane-recovery',
        owner: {
          kind: 'AUTHORED_GRANT',
          resourceGrantId: 'resource-arcane-recovery',
          source: {
            kind: 'AUTHORED',
            sourceKind: 'FEATURE',
            definitionId: '00000000-0000-4000-8000-000000000117',
            sourceInstanceId: 'feature:arcane-recovery'
          }
        },
        used: 1,
        max: 1,
        remaining: 0,
        recoveries: [{ trigger: 'LONG_REST', amount: { kind: 'ALL' } }]
      },
      {
        id: 'resource-wand-magic-missiles',
        label: 'Wand of Magic Missiles',
        description: '<p>Spend charges to cast magic missile without expending a spell slot.</p>',
        sourceLabel: 'Equipment',
        owner: {
          kind: 'ITEM_INSTANCE',
          chargeId: 'wand-magic-missiles-charges',
          itemInstanceId: '00000000-0000-4000-8000-000000000201'
        },
        used: 1,
        max: 7,
        remaining: 6,
        recoveries: [
          {
            trigger: 'DAWN',
            amount: { kind: 'DICE', dice: { count: 1, die: 6, modifier: 1 } }
          }
        ]
      }
    ],
    hitDice: [{ die: 6, total: 3, used: 1, remaining: 2 }]
  },
  spells: {
    saveDc: 13,
    attackBonus: 5,
    attackRollMode: 'NORMAL',
    slots: [
      { slotKey: 'STANDARD:1', label: 'Level 1', level: 1, used: 1, max: 4, remaining: 3 },
      { slotKey: 'STANDARD:2', label: 'Level 2', level: 2, used: 1, max: 2, remaining: 1 }
    ],
    activeGroups: [
      {
        level: 0,
        label: 'Cantrips',
        entries: [
          {
            rowId: 'class:wizard:fire-bolt:level:0',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-007900000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 0
            },
            spellId: '00000000-0000-0000-0020-007900000000',
            source: {
              spellId: '00000000-0000-0000-0020-007900000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Fire Bolt',
            castLevel: 0,
            activationType: 'ACTION',
            activationLabel: 'Action',
            rangeLabel: '120 ft',
            hitOrDcLabel: '+5',
            primaryEffect: '1d10 Fire',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-007900000000',
              sourceId: 'class:wizard'
            }
          },
          {
            rowId: 'class:wizard:mage-hand:level:0',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-00c300000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 0
            },
            spellId: '00000000-0000-0000-0020-00c300000000',
            source: {
              spellId: '00000000-0000-0000-0020-00c300000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Mage Hand',
            castLevel: 0,
            activationType: 'ACTION',
            activationLabel: 'Action',
            rangeLabel: '30 ft',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-00c300000000',
              sourceId: 'class:wizard'
            }
          },
          {
            rowId: 'class:wizard:prestidigitation:level:0',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-00ed00000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 0
            },
            spellId: '00000000-0000-0000-0020-00ed00000000',
            source: {
              spellId: '00000000-0000-0000-0020-00ed00000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Prestidigitation',
            castLevel: 0,
            activationType: 'ACTION',
            activationLabel: 'Action',
            rangeLabel: '10 ft',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-00ed00000000',
              sourceId: 'class:wizard'
            }
          }
        ]
      },
      {
        level: 1,
        label: 'Level 1',
        entries: [
          {
            rowId: 'class:wizard:detect-magic:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-005200000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-0000-0020-005200000000',
            source: {
              spellId: '00000000-0000-0000-0020-005200000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Detect Magic',
            castLevel: 1,
            activationType: 'ACTION',
            activationLabel: 'Action',
            rangeLabel: 'Self',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-005200000000',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:1'
            }
          },
          {
            rowId: 'class:wizard:magic-missile:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-00c600000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-0000-0020-00c600000000',
            source: {
              spellId: '00000000-0000-0000-0020-00c600000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Magic Missile',
            castLevel: 1,
            activationType: 'ACTION',
            activationLabel: 'Action',
            rangeLabel: '120 ft',
            primaryEffect: '3 × (1d4 + 1) Force',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-00c600000000',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:1'
            }
          },
          {
            rowId: 'class:wizard:shield:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-011000000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-0000-0020-011000000000',
            source: {
              spellId: '00000000-0000-0000-0020-011000000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Shield',
            castLevel: 1,
            activationType: 'REACTION',
            activationLabel: 'Reaction',
            rangeLabel: 'Self',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-011000000000',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:1'
            }
          }
        ]
      },
      {
        level: 2,
        label: 'Level 2',
        entries: [
          {
            rowId: 'class:wizard:misty-step:level:2',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-00d900000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 2
            },
            spellId: '00000000-0000-0000-0020-00d900000000',
            source: {
              spellId: '00000000-0000-0000-0020-00d900000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Misty Step',
            castLevel: 2,
            activationType: 'BONUS_ACTION',
            activationLabel: 'Bonus Action',
            rangeLabel: 'Self',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-00d900000000',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:2'
            }
          },
          {
            rowId: 'class:wizard:shatter:level:2',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-0000-0020-010f00000000',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 2
            },
            spellId: '00000000-0000-0000-0020-010f00000000',
            source: {
              spellId: '00000000-0000-0000-0020-010f00000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Shatter',
            castLevel: 2,
            activationType: 'ACTION',
            activationLabel: 'Action',
            rangeLabel: '60 ft',
            hitOrDcLabel: 'CON 13',
            primaryEffect: '3d8 Thunder',
            available: true,
            cast: {
              spellId: '00000000-0000-0000-0020-010f00000000',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:2'
            }
          }
        ]
      }
    ],
    preparationSources: [
      {
        classId: 'class-wizard',
        label: 'Wizard',
        preparedSpellIds: [
          '00000000-0000-0000-0020-005200000000',
          '00000000-0000-0000-0020-00c600000000',
          '00000000-0000-0000-0020-00d900000000',
          '00000000-0000-0000-0020-010f00000000',
          '00000000-0000-0000-0020-011000000000'
        ]
      }
    ],
    spells: [
      {
        id: '00000000-0000-0000-0020-007900000000',
        label: 'Fire Bolt',
        description: '<p>Hurl a mote of fire at a creature or object within range.</p>',
        level: 0,
        school: 'EVOCATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: [],
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-007900000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'KNOWN',
            castMode: 'AT_WILL',
            displayAsAttack: true,
            canPrepare: false,
            prepared: false
          }
        ],
        mechanics: [
          {
            effectId: 'effect-fire-bolt',
            trigger: 'RANGED_SPELL_ATTACK',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: '120 ft',
            attackBonus: 5,
            attackRollMode: 'NORMAL',
            outcomes: [
              {
                kind: 'DAMAGE',
                pathCode: 'ON_HIT',
                expression: '1d10',
                damageTypeId: 'fire',
                damageTypeLabel: 'Fire'
              }
            ]
          }
        ]
      },
      {
        id: '00000000-0000-0000-0020-00c300000000',
        label: 'Mage Hand',
        description: '<p>Create a spectral hand that manipulates nearby objects.</p>',
        level: 0,
        school: 'CONJURATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: [],
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-00c300000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'KNOWN',
            castMode: 'AT_WILL',
            canPrepare: false,
            prepared: false
          }
        ],
        mechanics: [
          {
            effectId: 'effect-mage-hand',
            trigger: 'ACTIVATED',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: '30 ft',
            outcomes: [
              {
                kind: 'EFFECT',
                pathCode: 'ON_USE',
                effectKind: 'MANIFEST',
                label: 'Manipulate a nearby object'
              }
            ]
          }
        ]
      },
      {
        id: '00000000-0000-0000-0020-00ed00000000',
        label: 'Prestidigitation',
        description: '<p>Create one of several harmless minor magical effects.</p>',
        level: 0,
        school: 'TRANSMUTATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: [],
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-00ed00000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'KNOWN',
            castMode: 'AT_WILL',
            canPrepare: false,
            prepared: false
          }
        ],
        mechanics: [
          {
            effectId: 'effect-prestidigitation',
            trigger: 'ACTIVATED',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: '10 ft',
            outcomes: [
              {
                kind: 'EFFECT',
                pathCode: 'ON_USE',
                effectKind: 'MANUAL_ADJUDICATION',
                label: 'Create a minor magical effect'
              }
            ]
          }
        ]
      },
      {
        id: '00000000-0000-0000-0020-011000000000',
        label: 'Shield',
        description: '<p>An invisible barrier of magical force appears and protects you.</p>',
        level: 1,
        school: 'ABJURATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: [],
        prepared: true,
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-011000000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'PREPARED',
            castMode: 'SPELL_SLOT',
            canPrepare: true,
            prepared: true
          }
        ],
        mechanics: [
          {
            effectId: 'effect-shield',
            trigger: 'ACTIVATED',
            activation: { kind: 'REACTION', amount: 1 },
            rangeLabel: 'Self',
            outcomes: [
              {
                kind: 'EFFECT',
                pathCode: 'ON_USE',
                effectKind: 'ARMOR_CLASS',
                label: '+5 Armor Class until the start of your next turn'
              }
            ]
          }
        ]
      },
      {
        id: '00000000-0000-0000-0020-00c600000000',
        label: 'Magic Missile',
        description: '<p>Create darts of magical force that strike creatures you can see.</p>',
        level: 1,
        school: 'EVOCATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: [],
        prepared: true,
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-00c600000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'PREPARED',
            castMode: 'SPELL_SLOT',
            canPrepare: true,
            prepared: true
          }
        ],
        mechanics: [
          {
            effectId: 'effect-magic-missile',
            trigger: 'ACTIVATED',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: '120 ft',
            outcomes: [
              {
                kind: 'DAMAGE',
                pathCode: 'ON_USE',
                expression: '3 × (1d4 + 1)',
                damageTypeId: 'force',
                damageTypeLabel: 'Force',
                scaling: [
                  { level: 1, expression: '3 × (1d4 + 1)' },
                  { level: 2, expression: '4 × (1d4 + 1)' }
                ]
              }
            ]
          }
        ]
      },
      {
        id: '00000000-0000-0000-0020-005200000000',
        label: 'Detect Magic',
        description: '<p>Sense the presence of magic within 30 feet.</p>',
        level: 1,
        school: 'DIVINATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: ['CONCENTRATION', 'RITUAL'],
        prepared: true,
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-005200000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'PREPARED',
            castMode: 'SPELL_SLOT',
            canPrepare: true,
            prepared: true
          }
        ],
        mechanics: [
          {
            effectId: 'effect-detect-magic',
            trigger: 'ACTIVATED',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: 'Self',
            outcomes: [
              {
                kind: 'EFFECT',
                pathCode: 'ON_USE',
                effectKind: 'SENSE',
                label: 'Sense nearby magic'
              }
            ]
          }
        ]
      },
      {
        id: '00000000-0000-0000-0020-00d900000000',
        label: 'Misty Step',
        description: '<p>Teleport up to 30 feet to an unoccupied space you can see.</p>',
        level: 2,
        school: 'CONJURATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL'],
        attributes: [],
        prepared: true,
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-00d900000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'PREPARED',
            castMode: 'SPELL_SLOT',
            canPrepare: true,
            prepared: true
          }
        ],
        mechanics: [
          {
            effectId: 'effect-misty-step',
            trigger: 'ACTIVATED',
            activation: { kind: 'BONUS_ACTION', amount: 1 },
            rangeLabel: 'Self',
            outcomes: [
              {
                kind: 'EFFECT',
                pathCode: 'ON_USE',
                effectKind: 'TELEPORT',
                label: 'Teleport up to 30 feet'
              }
            ]
          }
        ]
      },
      {
        id: '00000000-0000-0000-0020-010f00000000',
        label: 'Shatter',
        description:
          '<p>A sudden loud ringing noise erupts from a point you choose within range.</p>',
        level: 2,
        school: 'EVOCATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
        attributes: [],
        materialDescription: 'a chip of mica',
        prepared: true,
        known: true,
        sourceLabel: 'Wizard',
        sources: [
          {
            source: {
              spellId: '00000000-0000-0000-0020-010f00000000',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            classId: 'class-wizard',
            label: 'Wizard',
            provenance: 'CLASS',
            acquisition: 'PREPARED',
            castMode: 'SPELL_SLOT',
            canPrepare: true,
            prepared: true
          }
        ],
        mechanics: [
          {
            effectId: 'effect-shatter',
            trigger: 'ACTIVATED',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: '60 ft',
            save: { ability: 'CONSTITUTION', dc: 13 },
            outcomes: [
              {
                kind: 'DAMAGE',
                pathCode: 'ON_SAVE_FAIL',
                expression: '3d8',
                damageTypeId: 'thunder',
                damageTypeLabel: 'Thunder'
              }
            ]
          }
        ]
      }
    ]
  },
  inventory: {
    items: [
      {
        id: '00000000-0000-4000-8000-000000000301',
        equipmentId: 'equipment-staff',
        label: 'Quarterstaff',
        description: '<p>A sturdy staff marked with research notches and salt stains.</p>',
        category: 'WEAPON',
        properties: [
          { code: 'SIMPLE', label: 'Simple' },
          { code: 'VERSATILE', label: 'Versatile' }
        ],
        cost: { amount: 2, currencyId: 'sp' },
        costLabel: 'Silver',
        weight: { amount: 4, unit: 'POUNDS' },
        quantity: 1,
        equippedSlot: 'MAIN_HAND',
        attuned: false,
        requiresAttunement: false,
        notes: 'Used as a walking stick between delves.'
      },
      {
        id: '00000000-0000-4000-8000-000000000302',
        equipmentId: 'equipment-spellbook',
        label: 'Spellbook',
        description: '<p>A waterproof folio packed with marginalia and field sketches.</p>',
        category: 'ADVENTURING_GEAR',
        customName: 'Tidebound Folio',
        quantity: 1,
        equippedSlot: null,
        attuned: true,
        requiresAttunement: true
      },
      {
        id: '00000000-0000-4000-8000-000000000201',
        equipmentId: 'equipment-wand-magic-missiles',
        label: 'Wand of Magic Missiles',
        description:
          '<p>This wand has 7 charges and regains 1d6 + 1 expended charges daily at dawn.</p>',
        category: 'WONDROUS_ITEM',
        quantity: 1,
        equippedSlot: 'WORN',
        attuned: false,
        requiresAttunement: false
      }
    ],
    currencies: [
      { currencyId: 'gp', kind: 'RULESET', label: 'Gold', amount: 12 },
      { currencyId: 'sp', kind: 'RULESET', label: 'Silver', amount: 7 }
    ]
  },
  reference: {
    features: [
      {
        id: 'feature-spellcasting',
        label: 'Spellcasting',
        description: '<p>You prepare and cast wizard spells using Intelligence.</p>',
        sourceLabel: 'Wizard',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 }
      },
      {
        id: 'feature-elf-weapon-training',
        label: 'Elf Weapon Training',
        description:
          '<p>You have proficiency with the longsword, shortsword, shortbow, and longbow.</p>',
        sourceLabel: 'High Elf',
        source: { kind: 'SUBRACE', subraceId: 'subrace-high-elf' }
      },
      {
        id: 'feature-sculpt-spells',
        label: 'Sculpt Spells',
        description: '<p>Create pockets of safety for creatures within your evocation spells.</p>',
        sourceLabel: 'School of Evocation',
        source: { kind: 'CLASS', classId: 'subclass-evocation', classLevel: 2 }
      }
    ],
    proficiencies: [
      { kind: 'WEAPON', label: 'Quarterstaff', value: 'Equipment - Proficient' },
      { kind: 'WEAPON', label: 'Longsword', value: 'High Elf - Proficient' },
      { kind: 'LANGUAGE', label: 'Common', value: 'Language - Proficient' },
      { kind: 'LANGUAGE', label: 'Elvish', value: 'Language - Proficient' },
      { kind: 'LANGUAGE', label: 'Celestial', value: 'Acolyte - Proficient' },
      { kind: 'LANGUAGE', label: 'Dwarvish', value: 'Acolyte - Proficient' }
    ],
    defenses: [],
    senses: [{ senseId: 'darkvision', label: 'Darkvision', value: '60 feet' }],
    conditionOptions: [
      {
        id: 'condition-blinded',
        code: 'BLINDED',
        label: 'Blinded',
        description:
          'A blinded creature cannot see and automatically fails ability checks that require sight.'
      },
      {
        id: '00000000-0000-4000-8000-000000000601',
        code: 'POISONED',
        label: 'Poisoned',
        description: 'A poisoned creature has disadvantage on attack rolls and ability checks.'
      },
      {
        id: 'condition-prone',
        code: 'PRONE',
        label: 'Prone',
        description: 'A prone creature moves by crawling unless it stands up.'
      }
    ],
    equipmentOptions: [
      {
        id: 'equipment-staff',
        label: 'Quarterstaff',
        isContainer: false,
        requiresAttunement: false
      },
      {
        id: 'equipment-spellbook',
        label: 'Spellbook',
        isContainer: false,
        requiresAttunement: true
      },
      {
        id: 'equipment-component-pouch',
        label: 'Component Pouch',
        isContainer: false,
        requiresAttunement: false
      }
    ],
    currencyOptions: [
      { id: 'gp', kind: 'RULESET', label: 'Gold' },
      { id: 'sp', kind: 'RULESET', label: 'Silver' },
      { id: 'cp', kind: 'RULESET', label: 'Copper' }
    ]
  },
  notes: {
    alignment: 'Neutral Good',
    lifestyle: 'Modest',
    faith: 'Oghma',
    gender: 'Nonbinary',
    age: '86',
    appearance: 'Salt-white hair, bright sea-glass eyes, and ink-stained cuffs.',
    personalityTraits: 'Asks one more question than is safe.',
    ideals: 'Knowledge should be carried back to people who need it.',
    bonds: 'Owes her life to a missing mentor.',
    flaws: 'Cannot leave a sealed door unopened.',
    organizations: 'Acolyte of the House of Knowledge.',
    allies: 'Captain Rhyse of the Kelp Runner.',
    enemies: 'The drowned cult beneath Bellspire.',
    backstory:
      '<p>Astra left the reef libraries to find a mentor who vanished while researching planar tides.</p>',
    notes: '<p>Next session: ask the harbor master about the black-lacquered crate.</p>'
  },
  extras: {
    kindOptions: [],
    originOptions: [],
    items: []
  }
} satisfies CharacterSheetResponseDto
