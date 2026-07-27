import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import type {
  CharacterBuilderPayloadDto,
  CharacterBuilderPreviewPayloadDto,
  CharacterHistoryResponseDto,
  CharacterListResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterAuthoredDto } from '@artificer-toolkit/schema/subjects/character'

export const characterFixture = {
  id: 'character-owned',
  label: 'Astra Vale',
  description: '<p>A careful explorer with a dangerous curiosity.</p>',
  status: AUTHORED_RECORD_STATUS.ACTIVE,
  profile: {
    alignmentId: 'neutral-good',
    personalityTraits: 'Asks one more question than is safe.',
    ideals: 'Knowledge should be carried back to people who need it.',
    bonds: 'Owes her life to a missing mentor.',
    flaws: 'Cannot leave a sealed door unopened.'
  },
  intent: {
    advancement: { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
    race: { raceId: 'race-elf', subraceId: 'subrace-sea-elf' },
    ancestrySelections: [
      {
        id: 'ancestry-choice-1',
        ancestryId: 'ancestry-elf',
        optionId: 'ancestry-ocean',
        source: {
          kind: 'SUBRACE',
          subraceId: 'subrace-sea-elf'
        },
        timing: {
          kind: 'IMMEDIATE'
        }
      }
    ],
    background: { backgroundId: 'background-sage' },
    classes: [
      {
        classId: 'class-wizard',
        classLevel: 1,
        subclassId: 'subclass-scribe'
      }
    ],
    abilities: {
      method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
      assignments: [
        { ability: 'STRENGTH', option: '8' },
        { ability: 'DEXTERITY', option: '14' },
        { ability: 'CONSTITUTION', option: '13' },
        { ability: 'INTELLIGENCE', option: '15' },
        { ability: 'WISDOM', option: '12' },
        { ability: 'CHARISMA', option: '10' }
      ]
    },
    hitpoints: {
      method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
      levels: [{ level: 1, classId: 'class-wizard', classLevel: 1, value: 6 }]
    },
    featureAcquisitions: [],
    spellSelections: [],
    resourceGrants: []
  },
  state: {
    equipment: {
      inventory: [
        {
          id: 'inventory-1',
          equipmentId: 'equipment-staff',
          quantity: 1,
          notes: 'Used as a walking stick between delves.'
        }
      ],
      equipped: [],
      attuned: []
    },
    currency: [
      {
        id: 'currency-group-carried',
        currencies: [
          {
            currencyId: 'gp',
            amount: 10
          }
        ]
      }
    ],
    hitpoints: {
      current: 6,
      hitDice: [{ die: 6, total: 1, used: 0 }]
    }
  },
  systemId: 'system-5e',
  userId: 'user-1'
} satisfies CharacterAuthoredDto

export const characterBuilderPayloadFixture = {
  publicId: 'character-owned',
  character: characterFixture,
  resolution: {
    mode: 'edit',
    summary: {
      totalLevel: 1,
      abilities: {
        STRENGTH: 8,
        DEXTERITY: 14,
        CONSTITUTION: 13,
        INTELLIGENCE: 15,
        WISDOM: 12,
        CHARISMA: 10
      },
      selectedRace: {
        raceId: 'race-elf',
        raceLabel: 'Elf',
        subraceId: 'subrace-sea-elf',
        subraceLabel: 'Sea Elf',
        ancestryId: 'ancestry-elf',
        ancestryLabel: 'Elven Lineage',
        ancestryOptionId: 'ancestry-ocean',
        ancestryOptionLabel: 'Ocean'
      },
      selectedBackground: {
        backgroundId: 'background-sage',
        label: 'Sage'
      },
      classes: [
        {
          classId: 'class-wizard',
          classLabel: 'Wizard',
          classLevel: 1,
          subclassId: 'subclass-scribe',
          subclassLabel: 'Order of Scribes',
          featureLabels: ['Spellcasting'],
          resourceLabels: [],
          spellcastingLabels: ['Wizard Spells']
        }
      ]
    },
    grants: {
      features: [
        {
          id: 'feature-sea-elf-training',
          label: 'Sea Elf Training',
          description:
            '<p>You have proficiency with the spear, trident, light crossbow, and net.</p>',
          sourceLabel: 'Sea Elf',
          source: { kind: 'SUBRACE', subraceId: 'subrace-sea-elf' }
        },
        {
          id: 'feature-spellcasting',
          label: 'Spellcasting',
          description: '<p>You prepare and cast wizard spells using Intelligence.</p>',
          sourceLabel: 'Wizard',
          source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 }
        },
        {
          id: 'feature-researcher',
          label: 'Researcher',
          description:
            '<p>When you attempt to learn or recall lore, you know where to find it.</p>',
          sourceLabel: 'Sage',
          source: { kind: 'BACKGROUND', backgroundId: 'background-sage' }
        }
      ],
      resources: [],
      spellcasting: []
    },
    outstandingChoices: [],
    validations: [],
    readiness: {
      ready: true,
      blockingIssues: [],
      outstandingRequiredChoices: []
    },
    recommendedSectionId: 'BASICS'
  },
  references: {
    abilities: [
      { id: 'STRENGTH', label: 'Strength' },
      { id: 'DEXTERITY', label: 'Dexterity' },
      { id: 'CONSTITUTION', label: 'Constitution' },
      { id: 'INTELLIGENCE', label: 'Intelligence' },
      { id: 'WISDOM', label: 'Wisdom' },
      { id: 'CHARISMA', label: 'Charisma' }
    ],
    advancementMethods: [
      { id: 'MILESTONE', label: 'Milestone' },
      { id: 'EXPERIENCE', label: 'Experience' }
    ],
    abilityGenerationMethods: [
      { id: 'STANDARD_ARRAY', label: 'Standard Array' },
      { id: 'POINT_BUY', label: 'Point Buy' },
      { id: 'MANUAL_ROLLED', label: 'Manual / Rolled' }
    ],
    hitpointCalculationMethods: [
      { id: 'FIXED', label: 'Fixed' },
      { id: 'MANUAL', label: 'Manual' }
    ],
    standardArrayScores: ['8', '10', '12', '13', '14', '15'].map((score) => ({
      id: score,
      label: score
    })),
    pointBuyScores: [
      { id: '8', label: '8', cost: 0 },
      { id: '9', label: '9', cost: 1 },
      { id: '10', label: '10', cost: 2 },
      { id: '11', label: '11', cost: 3 },
      { id: '12', label: '12', cost: 4 },
      { id: '13', label: '13', cost: 5 },
      { id: '14', label: '14', cost: 7 },
      { id: '15', label: '15', cost: 9 }
    ],
    pointBuyTotalPoints: 27,
    races: [
      {
        id: 'race-elf',
        label: 'Elf',
        category: 'BASE',
        selectionMode: 'REQUIRES_SUBRACE',
        ancestry: {
          id: 'ancestry-elf',
          label: 'Elven Lineage',
          options: [
            { id: 'ancestry-ocean', label: 'Ocean', features: [] },
            { id: 'ancestry-forest', label: 'Forest', features: [] }
          ]
        }
      },
      {
        id: 'subrace-sea-elf',
        label: 'Sea Elf',
        category: 'SUBRACE',
        parentRaceId: 'race-elf',
        ancestry: {
          id: 'ancestry-elf',
          label: 'Elven Lineage',
          options: [
            { id: 'ancestry-ocean', label: 'Ocean', features: [] },
            {
              id: 'ancestry-forest',
              label: 'Forest',
              features: [
                {
                  id: 'feature-forest-adaptation',
                  label: 'Forest Adaptation',
                  description: '<p>You move confidently through wooded terrain.</p>',
                  sourceLabel: 'Forest',
                  source: {
                    kind: 'ANCESTRY',
                    ancestryId: 'ancestry-elf',
                    optionId: 'ancestry-forest'
                  }
                }
              ]
            }
          ]
        }
      }
    ],
    classes: [
      {
        id: 'class-wizard',
        label: 'Wizard',
        category: 'BASE',
        hitpoint: {
          ability: 'CONSTITUTION',
          dieConfig: '1d6'
        }
      },
      {
        id: 'class-fighter',
        label: 'Fighter',
        category: 'BASE',
        hitpoint: {
          ability: 'CONSTITUTION',
          dieConfig: '1d10'
        }
      },
      {
        id: 'subclass-scribe',
        label: 'Order of Scribes',
        category: 'SUBCLASS',
        parentClassId: 'class-wizard',
        specializations: [{ id: 'scribe-awakened', label: 'Awakened Quill' }]
      }
    ],
    backgrounds: [
      {
        id: 'background-sage',
        label: 'Sage',
        description: '<p>You spent years learning the lore of the multiverse.</p>',
        summary: 'You spent years learning the lore of the multiverse.',
        grantFacts: [{ label: 'Skills', value: 'Arcana, History' }],
        featureLabels: ['Researcher'],
        hiddenGrantFactCount: 0,
        hiddenFeatureCount: 0
      }
    ],
    equipment: [
      { id: 'equipment-staff', label: 'Quarterstaff' },
      { id: 'equipment-pack', label: 'Scholar Pack' }
    ],
    currencies: [
      { id: 'gp', label: 'Gold' },
      { id: 'sp', label: 'Silver' }
    ],
    alignments: [
      { id: 'lawful-good', label: 'Lawful Good' },
      { id: 'neutral-good', label: 'Neutral Good' }
    ],
    lifestyles: [
      { id: 'modest', label: 'Modest' },
      { id: 'comfortable', label: 'Comfortable' }
    ]
  },
  view: {
    race: {
      grantChoices: [],
      raceOptions: [{ id: 'race-elf', label: 'Elf' }],
      subraceOptions: [{ id: 'subrace-sea-elf', label: 'Sea Elf' }],
      ancestry: {
        ancestryId: 'ancestry-elf',
        label: 'Elven Lineage',
        selectedOptionId: 'ancestry-ocean',
        options: [
          { id: 'ancestry-ocean', label: 'Ocean' },
          { id: 'ancestry-forest', label: 'Forest' }
        ]
      },
      features: [
        {
          id: 'feature-sea-elf-training',
          label: 'Sea Elf Training',
          description:
            '<p>You have proficiency with the spear, trident, light crossbow, and net.</p>',
          sourceLabel: 'Sea Elf',
          source: { kind: 'SUBRACE', subraceId: 'subrace-sea-elf' }
        }
      ],
      featureChoices: []
    },
    classes: {
      classOptions: [
        { id: 'class-wizard', label: 'Wizard' },
        {
          id: 'class-fighter',
          label: 'Fighter',
          disabled: true,
          disabledReason: 'Requires Strength 13 or Dexterity 13'
        }
      ],
      selectedClasses: [
        {
          classId: 'class-wizard',
          classLabel: 'Wizard',
          classLevel: 1,
          grantChoices: [],
          proficiencyGroups: [
            {
              category: 'SAVING_THROWS',
              label: 'Saving Throws',
              grantedEntries: ['Intelligence', 'Wisdom'],
              choiceInstructions: [],
              choiceIds: []
            }
          ],
          subclassOptions: [{ id: 'subclass-scribe', label: 'Order of Scribes' }],
          specializationOptions: [{ id: 'scribe-awakened', label: 'Awakened Quill' }],
          featureLabels: ['Spellcasting'],
          features: [
            {
              id: 'feature-spellcasting',
              label: 'Spellcasting',
              description: '<p>You prepare and cast wizard spells using Intelligence.</p>',
              sourceLabel: 'Wizard',
              source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 }
            }
          ],
          featureChoices: [],
          spellChoices: []
        }
      ]
    },
    background: {
      grantChoices: [],
      backgroundOptions: [{ id: 'background-sage', label: 'Sage' }],
      description: '<p>You spent years learning the lore of the multiverse.</p>',
      detailSections: [
        {
          label: 'Personality Traits',
          details: [
            {
              id: 'sage-trait-1',
              label: 'Personality Trait 1',
              description:
                '<p>I use polysyllabic words that convey the impression of great erudition.</p>'
            }
          ]
        }
      ],
      features: [
        {
          id: 'feature-researcher',
          label: 'Researcher',
          description:
            '<p>When you attempt to learn or recall lore, you know where to find it.</p>',
          details: [
            {
              id: 'researcher-sources',
              label: 'Sources of information',
              description: '<p>You know where and from whom information can be obtained.</p>'
            }
          ],
          sourceLabel: 'Sage',
          source: { kind: 'BACKGROUND', backgroundId: 'background-sage' }
        }
      ],
      featureChoices: []
    },
    equipment: {
      classStartingEquipmentRequired: false,
      backgroundStartingEquipmentRequired: false,
      classStartingEquipment: null,
      backgroundStartingEquipment: null,
      equipmentOptions: [
        {
          id: 'equipment-staff',
          label: 'Quarterstaff',
          category: 'WEAPON',
          properties: ['SIMPLE']
        },
        {
          id: 'equipment-pack',
          label: 'Scholar Pack',
          category: 'ADVENTURING_GEAR',
          properties: []
        }
      ],
      currencyOptions: [
        { id: 'gp', label: 'Gold' },
        { id: 'sp', label: 'Silver' }
      ]
    },
    review: {
      blockers: [],
      warnings: [],
      ready: true
    }
  }
} satisfies CharacterBuilderPayloadDto

export const characterBuilderDraftPayloadFixture = {
  ...characterBuilderPayloadFixture,
  publicId: 'character-draft',
  character: {
    ...characterFixture,
    id: 'character-draft',
    label: '',
    status: AUTHORED_RECORD_STATUS.DRAFT,
    intent: {
      ...characterFixture.intent,
      race: { raceId: '' },
      background: { backgroundId: '' },
      classes: [],
      abilities: {
        method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
        assignments: []
      },
      hitpoints: {
        method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
        levels: []
      }
    }
  },
  resolution: {
    ...characterBuilderPayloadFixture.resolution,
    mode: 'create',
    summary: {
      totalLevel: 0,
      abilities: {},
      classes: []
    },
    readiness: {
      ready: false,
      blockingIssues: ['Choose a race.', 'Choose a class.'],
      outstandingRequiredChoices: ['Race', 'Class']
    },
    recommendedSectionId: 'RACE'
  },
  view: {
    ...characterBuilderPayloadFixture.view,
    race: {
      ...characterBuilderPayloadFixture.view.race,
      ancestry: null,
      features: [],
      featureChoices: []
    },
    classes: {
      ...characterBuilderPayloadFixture.view.classes,
      selectedClasses: []
    },
    background: {
      ...characterBuilderPayloadFixture.view.background,
      features: [],
      featureChoices: []
    },
    review: {
      blockers: ['Choose a race.', 'Choose a class.'],
      warnings: [],
      ready: false
    }
  }
} satisfies CharacterBuilderPayloadDto

export const characterPreviewFixture = {
  character: characterFixture,
  resolution: characterBuilderPayloadFixture.resolution,
  preview: {
    predictedStatus: AUTHORED_RECORD_STATUS.ACTIVE,
    downgradesStatus: false,
    removedAncestrySelections: [],
    removedFeatureAcquisitions: [],
    removedSpellSelections: [],
    removedResourceGrants: [],
    clearedStartingEquipmentSources: [],
    summaryLines: ['Finalize Astra Vale as an active character.'],
    destructive: false
  }
} satisfies CharacterBuilderPreviewPayloadDto

export const characterSheetFixture = {
  publicId: 'character-owned',
  meta: {
    characterId: characterFixture.id,
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
      { ability: 'STRENGTH', score: 8, modifier: -1 },
      { ability: 'DEXTERITY', score: 14, modifier: 2 },
      { ability: 'CONSTITUTION', score: 13, modifier: 1 },
      { ability: 'INTELLIGENCE', score: 16, modifier: 3 },
      { ability: 'WISDOM', score: 12, modifier: 1 },
      { ability: 'CHARISMA', score: 10, modifier: 0 }
    ],
    facts: [
      { label: 'Speed', value: '30 feet' },
      { label: 'Passive Perception', value: '13' },
      { label: 'Passive Investigation', value: '13' },
      { label: 'Passive Insight', value: '11' }
    ],
    armorClass: 12,
    initiative: 2,
    proficiencyBonus: 2,
    currentHitPoints: 14,
    maxHitPoints: 17,
    tempHitPoints: 4,
    maxHitPointsOverride: null,
    exhaustionLevel: 1,
    exhaustionNotes: 'Forced march through the drowned road.',
    conditions: [
      {
        conditionTypeId: 'condition-poisoned',
        label: 'Poisoned',
        description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
        notes: 'Spider venom, save at end of turn.'
      }
    ],
    hitDice: [{ die: 6, total: 3, used: 1, remaining: 2 }],
    savingThrows: [
      { ability: 'STRENGTH', label: 'Strength', total: -1, proficiency: 'NONE' },
      { ability: 'DEXTERITY', label: 'Dexterity', total: 2, proficiency: 'NONE' },
      { ability: 'CONSTITUTION', label: 'Constitution', total: 1, proficiency: 'NONE' },
      { ability: 'INTELLIGENCE', label: 'Intelligence', total: 5, proficiency: 'FULL' },
      { ability: 'WISDOM', label: 'Wisdom', total: 3, proficiency: 'FULL' },
      { ability: 'CHARISMA', label: 'Charisma', total: 0, proficiency: 'NONE' }
    ],
    skills: [
      {
        skillId: 'acrobatics',
        code: 'ACROBATICS',
        label: 'Acrobatics',
        ability: 'DEXTERITY',
        total: 2,
        proficiency: 'NONE'
      },
      {
        skillId: 'animal-handling',
        code: 'ANIMAL_HANDLING',
        label: 'Animal Handling',
        ability: 'WISDOM',
        total: 1,
        proficiency: 'NONE'
      },
      {
        skillId: 'arcana',
        code: 'ARCANA',
        label: 'Arcana',
        ability: 'INTELLIGENCE',
        total: 5,
        proficiency: 'FULL'
      },
      {
        skillId: 'athletics',
        code: 'ATHLETICS',
        label: 'Athletics',
        ability: 'STRENGTH',
        total: -1,
        proficiency: 'NONE'
      },
      {
        skillId: 'deception',
        code: 'DECEPTION',
        label: 'Deception',
        ability: 'CHARISMA',
        total: 0,
        proficiency: 'NONE'
      },
      {
        skillId: 'history',
        code: 'HISTORY',
        label: 'History',
        ability: 'INTELLIGENCE',
        total: 5,
        proficiency: 'FULL'
      },
      {
        skillId: 'insight',
        code: 'INSIGHT',
        label: 'Insight',
        ability: 'WISDOM',
        total: 1,
        proficiency: 'NONE'
      },
      {
        skillId: 'intimidation',
        code: 'INTIMIDATION',
        label: 'Intimidation',
        ability: 'CHARISMA',
        total: 0,
        proficiency: 'NONE'
      },
      {
        skillId: 'investigation',
        code: 'INVESTIGATION',
        label: 'Investigation',
        ability: 'INTELLIGENCE',
        total: 3,
        proficiency: 'NONE'
      },
      {
        skillId: 'medicine',
        code: 'MEDICINE',
        label: 'Medicine',
        ability: 'WISDOM',
        total: 1,
        proficiency: 'NONE'
      },
      {
        skillId: 'nature',
        code: 'NATURE',
        label: 'Nature',
        ability: 'INTELLIGENCE',
        total: 3,
        proficiency: 'NONE'
      },
      {
        skillId: 'perception',
        code: 'PERCEPTION',
        label: 'Perception',
        ability: 'WISDOM',
        total: 3,
        proficiency: 'FULL'
      },
      {
        skillId: 'performance',
        code: 'PERFORMANCE',
        label: 'Performance',
        ability: 'CHARISMA',
        total: 0,
        proficiency: 'NONE'
      },
      {
        skillId: 'persuasion',
        code: 'PERSUASION',
        label: 'Persuasion',
        ability: 'CHARISMA',
        total: 0,
        proficiency: 'NONE'
      },
      {
        skillId: 'religion',
        code: 'RELIGION',
        label: 'Religion',
        ability: 'INTELLIGENCE',
        total: 3,
        proficiency: 'NONE'
      },
      {
        skillId: 'sleight-of-hand',
        code: 'SLEIGHT_OF_HAND',
        label: 'Sleight of Hand',
        ability: 'DEXTERITY',
        total: 2,
        proficiency: 'NONE'
      },
      {
        skillId: 'stealth',
        code: 'STEALTH',
        label: 'Stealth',
        ability: 'DEXTERITY',
        total: 2,
        proficiency: 'NONE'
      },
      {
        skillId: 'survival',
        code: 'SURVIVAL',
        label: 'Survival',
        ability: 'WISDOM',
        total: 1,
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
        sourceLabel: 'Equipment',
        description: '<p>A sturdy staff marked with research notches and salt stains.</p>',
        rollable: true,
        mechanic: {
          effectId: 'effect-quarterstaff-attack',
          trigger: 'ATTACK_ROLL',
          activation: { kind: 'ACTION', amount: 1 },
          rangeLabel: '5 ft',
          attackBonus: 4,
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
            trigger: 'SPELL_ATTACK',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: '120 ft',
            attackBonus: 5,
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
        equipped: true,
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
        equipped: false,
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
        equipped: true,
        attuned: false,
        requiresAttunement: false
      }
    ],
    currencies: [
      { currencyId: 'gp', label: 'Gold', amount: 12 },
      { currencyId: 'sp', label: 'Silver', amount: 7 }
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
        label: 'Blinded',
        description:
          'A blinded creature cannot see and automatically fails ability checks that require sight.'
      },
      {
        id: 'condition-poisoned',
        label: 'Poisoned',
        description: 'A poisoned creature has disadvantage on attack rolls and ability checks.'
      },
      {
        id: 'condition-prone',
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
      { id: 'gp', label: 'Gold' },
      { id: 'sp', label: 'Silver' },
      { id: 'cp', label: 'Copper' }
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
  }
} satisfies CharacterSheetResponseDto

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
      { ability: 'STRENGTH', score: 10, modifier: 0 },
      { ability: 'DEXTERITY', score: 16, modifier: 3 },
      { ability: 'CONSTITUTION', score: 14, modifier: 2 },
      { ability: 'INTELLIGENCE', score: 10, modifier: 0 },
      { ability: 'WISDOM', score: 13, modifier: 1 },
      { ability: 'CHARISMA', score: 12, modifier: 1 }
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
    exhaustionLevel: 0,
    exhaustionNotes: undefined,
    conditions: [],
    hitDice: [
      { die: 10, total: 2, used: 1, remaining: 1 },
      { die: 8, total: 1, used: 0, remaining: 1 }
    ],
    savingThrows: [
      { ability: 'STRENGTH', label: 'Strength', total: 2, proficiency: 'FULL' },
      { ability: 'DEXTERITY', label: 'Dexterity', total: 3, proficiency: 'NONE' },
      { ability: 'CONSTITUTION', label: 'Constitution', total: 4, proficiency: 'FULL' },
      { ability: 'INTELLIGENCE', label: 'Intelligence', total: 0, proficiency: 'NONE' },
      { ability: 'WISDOM', label: 'Wisdom', total: 1, proficiency: 'NONE' },
      { ability: 'CHARISMA', label: 'Charisma', total: 1, proficiency: 'NONE' }
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
          {
            STRENGTH: 0,
            DEXTERITY: 3,
            CONSTITUTION: 2,
            INTELLIGENCE: 0,
            WISDOM: 1,
            CHARISMA: 1
          }[skill.ability],
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
        sourceLabel: 'Equipment',
        description: '<p>A quick finesse weapon suited to close combat.</p>',
        rollable: true,
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
        sourceLabel: 'Fighter',
        description: '<p>Regain 1d10 + 2 hit points.</p>',
        resourceGrantId: 'resource-second-wind'
      },
      {
        id: 'action-action-surge',
        label: 'Action Surge',
        kind: 'OTHER',
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
        equipped: true,
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
        equipped: false,
        attuned: false,
        requiresAttunement: false
      }
    ],
    currencies: [{ currencyId: 'gp', label: 'Gold', amount: 15 }]
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

export const characterSheetSpellStatesFixture = {
  ...characterSheetFixture,
  spells: {
    ...characterSheetFixture.spells,
    slots: [
      { slotKey: 'STANDARD:1', label: 'Level 1', level: 1, used: 4, max: 4, remaining: 0 },
      { slotKey: 'STANDARD:2', label: 'Level 2', level: 2, used: 1, max: 2, remaining: 1 }
    ],
    activeGroups: [
      {
        level: 1,
        label: 'Level 1',
        entries: [
          {
            rowId: 'spell:shield:prepared:wizard:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000115',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-4000-8000-000000000115',
            source: {
              spellId: '00000000-0000-4000-8000-000000000115',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Shield',
            castLevel: 1,
            activationType: 'REACTION',
            available: false,
            unavailableReason: 'All Level 1 spell slots are expended.',
            cast: {
              spellId: '00000000-0000-4000-8000-000000000115',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:1'
            }
          },
          {
            rowId: 'spell:magic-missile:known:wizard:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000113',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-4000-8000-000000000113',
            source: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Magic Missile',
            sourceQualifier: 'Wizard',
            castLevel: 1,
            activationType: 'ACTION',
            primaryEffect: '3 × (1d4 + 1) Force',
            available: false,
            unavailableReason: 'All Level 1 spell slots are expended.',
            cast: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:1'
            }
          },
          {
            rowId: 'spell:magic-missile:granted:feat:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000113',
                sourceKind: 'FEAT',
                sourceInstanceId: 'feat:magic-initiate'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-4000-8000-000000000113',
            source: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceKind: 'FEAT',
              sourceInstanceId: 'feat:magic-initiate'
            },
            sourceId: 'feat:magic-initiate',
            displayName: 'Magic Missile',
            sourceQualifier: 'Magic Initiate',
            castLevel: 1,
            activationType: 'ACTION',
            primaryEffect: '3 × (1d4 + 1) Force',
            available: true,
            cast: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceId: 'feat:magic-initiate'
            }
          }
        ]
      },
      {
        level: 2,
        label: 'Level 2',
        entries: [
          {
            rowId: 'spell:magic-missile:known:wizard:level:2',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000113',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 2
            },
            spellId: '00000000-0000-4000-8000-000000000113',
            source: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Magic Missile',
            castLevel: 2,
            activationType: 'ACTION',
            primaryEffect: '4 × (1d4 + 1) Force',
            available: true,
            cast: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:2'
            }
          }
        ]
      }
    ],
    spells: characterSheetFixture.spells.spells.map((spell) =>
      spell.id === 'spell-shield'
        ? {
            ...spell,
            sources: spell.sources?.map((source) => ({
              ...source,
              acquisition: 'PREPARED' as const,
              prepared: true
            }))
          }
        : spell.id === 'spell-magic-missile'
          ? {
              ...spell,
              sources: spell.sources?.map((source) => ({
                ...source,
                acquisition: 'KNOWN' as const,
                prepared: false,
                canPrepare: false
              }))
            }
          : {
              ...spell,
              sources: spell.sources?.map((source) => ({
                ...source,
                acquisition: 'GRANTED' as const,
                prepared: false,
                canPrepare: false,
                castMode: 'AT_WILL' as const
              }))
            }
    )
  }
} satisfies CharacterSheetResponseDto

export const characterHistoryFixture = {
  characterId: characterFixture.id,
  entries: [
    {
      eventId: 'history-1',
      occurredAt: '2026-05-05T14:15:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: 'Shield marked prepared for Wizard'
    },
    {
      eventId: 'history-2',
      occurredAt: '2026-05-05T13:58:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: '1 Level 2 spell slot restored'
    },
    {
      eventId: 'history-3',
      occurredAt: '2026-05-05T13:44:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: 'Poisoned added'
    },
    {
      eventId: 'history-4',
      occurredAt: '2026-05-05T13:30:00.000Z',
      actorId: 'user-1',
      eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
      summary: 'Quarterstaff quantity reduced by 1'
    }
  ]
} satisfies CharacterHistoryResponseDto

export const characterListFixture = {
  items: [
    {
      id: characterFixture.id,
      publicId: 'character-owned',
      label: characterFixture.label,
      status: AUTHORED_RECORD_STATUS.ACTIVE,
      systemId: characterFixture.systemId,
      streamVersion: 1
    },
    {
      id: 'character-draft',
      publicId: 'character-draft',
      label: '',
      status: AUTHORED_RECORD_STATUS.DRAFT,
      systemId: characterFixture.systemId,
      streamVersion: 0,
      draft: {
        characterId: 'character-draft',
        publicId: 'character-draft',
        userId: 'user-1',
        systemId: characterFixture.systemId,
        label: '',
        status: AUTHORED_RECORD_STATUS.DRAFT,
        draftState: 'DRAFT_ONLY',
        baseActiveUpdatedAt: null,
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z'
      }
    }
  ],
  meta: {}
} satisfies CharacterListResponseDto
