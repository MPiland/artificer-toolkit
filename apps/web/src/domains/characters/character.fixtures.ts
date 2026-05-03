import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import type {
  CharacterBuilderPayloadDto,
  CharacterBuilderPreviewPayloadDto,
  CharacterListResponseDto
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
      levels: [{ level: 1, value: 6 }]
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
      features: [],
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
      { id: 'class-wizard', label: 'Wizard', category: 'BASE' },
      { id: 'class-fighter', label: 'Fighter', category: 'BASE' },
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
          subclassOptions: [{ id: 'subclass-scribe', label: 'Order of Scribes' }],
          specializationOptions: [{ id: 'scribe-awakened', label: 'Awakened Quill' }],
          featureLabels: ['Spellcasting'],
          featureChoices: [],
          spellChoices: [],
          resourceLabels: [],
          spellcastingLabels: ['Wizard Spells']
        }
      ]
    },
    background: {
      backgroundOptions: [{ id: 'background-sage', label: 'Sage' }],
      featureChoices: []
    },
    equipment: {
      classStartingEquipmentRequired: false,
      backgroundStartingEquipmentRequired: false,
      classStartingEquipment: null,
      backgroundStartingEquipment: null,
      equipmentOptions: [
        { id: 'equipment-staff', label: 'Quarterstaff' },
        { id: 'equipment-pack', label: 'Scholar Pack' }
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
    classes: {
      ...characterBuilderPayloadFixture.view.classes,
      selectedClasses: []
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

export const characterListFixture = {
  items: [
    {
      id: characterFixture.id,
      label: characterFixture.label,
      status: AUTHORED_RECORD_STATUS.ACTIVE,
      systemId: characterFixture.systemId,
      streamVersion: 1
    },
    {
      id: 'character-draft',
      label: '',
      status: AUTHORED_RECORD_STATUS.DRAFT,
      systemId: characterFixture.systemId,
      streamVersion: 0,
      draft: {
        characterId: 'character-draft',
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
