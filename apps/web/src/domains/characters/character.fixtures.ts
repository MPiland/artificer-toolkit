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
          description: '<p>You have proficiency with the spear, trident, light crossbow, and net.</p>',
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
          description: '<p>When you attempt to learn or recall lore, you know where to find it.</p>',
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
    races: [
      {
        id: 'race-elf',
        label: 'Elf',
        category: 'BASE',
        ancestry: {
          id: 'ancestry-elf',
          label: 'Elven Lineage',
          options: [
            { id: 'ancestry-ocean', label: 'Ocean' },
            { id: 'ancestry-forest', label: 'Forest' }
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
          options: [{ id: 'ancestry-ocean', label: 'Ocean' }]
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
    backgrounds: [{ id: 'background-sage', label: 'Sage' }],
    equipment: [
      { id: 'equipment-staff', label: 'Quarterstaff' },
      { id: 'equipment-pack', label: 'Scholar Pack' }
    ],
    currencies: [
      { id: 'gp', label: 'Gold' },
      { id: 'sp', label: 'Silver' }
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
          description: '<p>You have proficiency with the spear, trident, light crossbow, and net.</p>',
          sourceLabel: 'Sea Elf',
          source: { kind: 'SUBRACE', subraceId: 'subrace-sea-elf' }
        }
      ],
      featureChoices: []
    },
    classes: {
      classOptions: [
        { id: 'class-wizard', label: 'Wizard' },
        { id: 'class-fighter', label: 'Fighter', disabled: true, disabledReason: 'Requires Strength 13 or Dexterity 13' }
      ],
      selectedClasses: [
        {
          classId: 'class-wizard',
          classLabel: 'Wizard',
          classLevel: 1,
          grantChoices: [],
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
          spellChoices: [],
          resourceLabels: [],
          spellcastingLabels: ['Wizard Spells']
        }
      ]
    },
    background: {
      grantChoices: [],
      backgroundOptions: [{ id: 'background-sage', label: 'Sage' }],
      features: [
        {
          id: 'feature-researcher',
          label: 'Researcher',
          description: '<p>When you attempt to learn or recall lore, you know where to find it.</p>',
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
    raceLabel: 'Sea Elf',
    backgroundLabel: 'Sage',
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
      { label: 'Passive Perception', value: '13' }
    ],
    armorClass: 13,
    initiative: 2,
    proficiencyBonus: 2,
    currentHitPoints: 14,
    maxHitPoints: 20,
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
      { skillId: 'arcana', code: 'ARCANA', label: 'Arcana', ability: 'INTELLIGENCE', total: 5, proficiency: 'FULL' },
      { skillId: 'history', code: 'HISTORY', label: 'History', ability: 'INTELLIGENCE', total: 5, proficiency: 'FULL' },
      { skillId: 'investigation', code: 'INVESTIGATION', label: 'Investigation', ability: 'INTELLIGENCE', total: 3, proficiency: 'NONE' },
      { skillId: 'perception', code: 'PERCEPTION', label: 'Perception', ability: 'WISDOM', total: 3, proficiency: 'FULL' },
      { skillId: 'stealth', code: 'STEALTH', label: 'Stealth', ability: 'DEXTERITY', total: 2, proficiency: 'NONE' }
    ]
  },
  actions: {
    items: [
      {
        id: 'action-arcane-recovery',
        label: 'Arcane Recovery',
        kind: 'OTHER',
        sourceLabel: 'Wizard',
        description: '<p>Once per day after a short rest, recover expended spell slots.</p>',
        rollable: false,
        mechanic: {
          effectId: 'effect-arcane-recovery',
          trigger: 'ACTIVATED',
          activation: { kind: 'OTHER', amount: 1 },
          rangeLabel: 'Self',
          outcomes: [
            {
              kind: 'EFFECT',
              pathCode: 'ON_USE',
              effectKind: 'RESOURCE_RECOVERY',
              label: 'Recover expended spell slots'
            }
          ]
        }
      },
      {
        id: 'action-trance',
        label: 'Trance',
        kind: 'OTHER',
        sourceLabel: 'Sea Elf',
        description: '<p>Meditate deeply instead of sleeping, remaining semiconscious.</p>'
      }
    ]
  },
  resources: {
    items: [
      {
        id: 'resource-arcane-recovery',
        label: 'Arcane Recovery',
        description: '<p>Recover spell slots with a combined level up to half your wizard level.</p>',
        sourceLabel: 'Wizard',
        used: 1,
        max: 1,
        remaining: 0,
        recovery: 'LONG_REST'
      },
      {
        id: 'resource-scribe-quill',
        label: 'Awakened Quill',
        description: '<p>Write with a spectral quill and change damage types through your spellbook.</p>',
        sourceLabel: 'Order of Scribes',
        used: 0,
        max: 2,
        remaining: 2,
        recovery: 'LONG_REST'
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
    preparationSources: [
      {
        classId: 'class-wizard',
        label: 'Wizard',
        preparedSpellIds: ['spell-shield', 'spell-mage-armor']
      }
    ],
    spells: [
      {
        id: 'spell-shield',
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
        sources: [{ classId: 'class-wizard', label: 'Wizard', provenance: 'CLASS', acquisition: 'PREPARED', castMode: 'SPELL_SLOT', canPrepare: true, prepared: true }],
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
        id: 'spell-magic-missile',
        label: 'Magic Missile',
        description: '<p>Create darts of magical force that strike creatures you can see.</p>',
        level: 1,
        school: 'EVOCATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: [],
        prepared: false,
        known: true,
        sourceLabel: 'Wizard',
        sources: [{ classId: 'class-wizard', label: 'Wizard', provenance: 'CLASS', acquisition: 'PREPARED', castMode: 'SPELL_SLOT', canPrepare: true, prepared: false }],
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
        id: 'spell-detect-magic',
        label: 'Detect Magic',
        description: '<p>Sense the presence of magic within 30 feet.</p>',
        level: 1,
        school: 'DIVINATION',
        castingTime: { amount: 1, unit: 'ROUND' },
        components: ['VERBAL', 'SOMATIC'],
        attributes: ['CONCENTRATION', 'RITUAL'],
        prepared: false,
        known: true,
        sourceLabel: 'Wizard',
        sources: [{ classId: 'class-wizard', label: 'Wizard', provenance: 'CLASS', acquisition: 'PREPARED', castMode: 'SPELL_SLOT', canPrepare: true, prepared: false }],
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
      }
    ]
  },
  inventory: {
    items: [
      {
        id: 'inventory-staff',
        equipmentId: 'equipment-staff',
        label: 'Quarterstaff',
        description: '<p>A sturdy staff marked with research notches and salt stains.</p>',
        category: 'WEAPON',
        properties: ['SIMPLE', 'VERSATILE'],
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
        id: 'inventory-book',
        equipmentId: 'equipment-spellbook',
        label: 'Spellbook',
        description: '<p>A waterproof folio packed with marginalia and field sketches.</p>',
        category: 'ADVENTURING_GEAR',
        customName: 'Tidebound Folio',
        quantity: 1,
        equipped: false,
        attuned: true,
        requiresAttunement: true
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
        id: 'feature-sea-elf-training',
        label: 'Sea Elf Training',
        description: '<p>You have proficiency with the spear, trident, light crossbow, and net.</p>',
        sourceLabel: 'Sea Elf',
        source: { kind: 'SUBRACE', subraceId: 'subrace-sea-elf' }
      }
    ],
    proficiencies: [
      { label: 'Arcana', value: 'Skill - Proficient' },
      { label: 'History', value: 'Skill - Proficient' },
      { label: 'Quarterstaff', value: 'Weapon - Proficient' }
    ],
    defenses: [{ kind: 'RESISTANCE', damageTypeId: 'poison', label: 'Poison', value: 'Resistance' }],
    senses: [{ senseId: 'darkvision', label: 'Darkvision', value: '60 feet' }],
    conditionOptions: [
      {
        id: 'condition-blinded',
        label: 'Blinded',
        description: 'A blinded creature cannot see and automatically fails ability checks that require sight.'
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
    faith: 'The open sea',
    gender: 'Nonbinary',
    age: '86',
    appearance: 'Salt-white hair, bright sea-glass eyes, and ink-stained cuffs.',
    personalityTraits: 'Asks one more question than is safe.',
    ideals: 'Knowledge should be carried back to people who need it.',
    bonds: 'Owes her life to a missing mentor.',
    flaws: 'Cannot leave a sealed door unopened.',
    organizations: 'Corresponding member of the Azure Archive.',
    allies: 'Captain Rhyse of the Kelp Runner.',
    enemies: 'The drowned cult beneath Bellspire.',
    backstory: '<p>Astra left the reef libraries to find a mentor who vanished while researching planar tides.</p>',
    notes: '<p>Next session: ask the harbor master about the black-lacquered crate.</p>'
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
