import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import type {
  CharacterBuilderPayloadDto,
  CharacterBuilderPreviewPayloadDto
} from '@artificer-toolkit/schema/api/characters'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'

export const characterFixture = characterAuthoredDtoSchema.parse({
  id: '00000000-0000-4000-8000-000000000101',
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
            kind: 'RULESET',
            amount: 10
          }
        ]
      }
    ],
    hitpoints: {
      current: 6,
      temp: 0,
      hitDice: [{ die: 6, total: 1, used: 0 }],
      deathSaves: NO_DEATH_SAVES
    }
  },
  primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
  systemId: SRD_SYSTEM_ID,
  userId: 'user-1'
})

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
