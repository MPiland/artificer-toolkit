import { describe, expect, it } from 'vitest'

import { createEmptyCharacterAuthored, type CharacterBuilderResolution } from './builderService.js'
import {
  CLASS_CATEGORY,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  RACE_CATEGORY_CODE,
  SUBJECT
} from '@artificer-toolkit/shared/core'
import { buildCharacterBuilderView } from './characterApplicationService.js'

type Character = Parameters<typeof buildCharacterBuilderView>[0]

function createCharacter(): Character {
  return createEmptyCharacterAuthored({
    id: 'character-1',
    systemId: 'system-1',
    userId: 'user-1'
  })
}

function createResolution(
  overrides: Partial<CharacterBuilderResolution> = {}
): CharacterBuilderResolution {
  return {
    mode: 'create',
    catalog: {
      races: [
        { id: 'race-dragonborn', label: 'Dragonborn', category: RACE_CATEGORY_CODE.BASE },
        { id: 'race-half-elf', label: 'Half-Elf', category: RACE_CATEGORY_CODE.BASE }
      ],
      classes: [
        {
          id: 'class-wizard',
          label: 'Wizard',
          category: CLASS_CATEGORY.BASE,
          subclassSelectionLevel: 2
        },
        {
          id: 'subclass-scribe',
          label: 'Order of Scribes',
          category: CLASS_CATEGORY.SUBCLASS,
          parentClassId: 'class-wizard'
        }
      ],
      backgrounds: [
        {
          id: 'background-sage',
          label: 'Sage',
          description: 'A scholarly life.',
          summary: 'A scholarly life.',
          grantFacts: [],
          featureLabels: ['Researcher'],
          hiddenGrantFactCount: 0,
          hiddenFeatureCount: 0
        }
      ],
      equipment: [],
      feats: [],
      spells: []
    },
    registry: {
      system: null,
      races: [
        {
          id: 'race-dragonborn',
          label: 'Dragonborn',
          category: RACE_CATEGORY_CODE.BASE,
          ancestry: {
            id: 'ancestry-draconic',
            label: 'Draconic Ancestry',
            options: [
              { id: 'ancestry-red', label: 'Red (Fire)' },
              { id: 'ancestry-blue', label: 'Blue (Lightning)' }
            ]
          }
        } as CharacterBuilderResolution['registry']['races'][number],
        {
          id: 'race-half-elf',
          label: 'Half-Elf',
          category: RACE_CATEGORY_CODE.BASE,
          features: [
            {
              id: 'feature-half-elf-ability-score-increase',
              label: 'Ability Score Increase',
              availableAtLevel: 1,
              order: 0,
              optionChoices: [{ level: 1, count: 2 }],
              options: [
                { id: 'option-strength', label: 'Strength', order: 0 },
                { id: 'option-dexterity', label: 'Dexterity', order: 1 },
                { id: 'option-constitution', label: 'Constitution', order: 2 },
                { id: 'option-intelligence', label: 'Intelligence', order: 3 },
                { id: 'option-wisdom', label: 'Wisdom', order: 4 }
              ]
            }
          ]
        } as CharacterBuilderResolution['registry']['races'][number]
      ],
      classes: [
        {
          id: 'class-wizard',
          label: 'Wizard',
          userId: 'user-1',
          systemId: 'system-1',
          category: CLASS_CATEGORY.BASE,
          subclassSelectionLevel: 2,
          multiclass: { id: 'wizard-multiclass', requirementGroups: { groups: [] } },
          startingGold: {
            currencyId: 'gp',
            dieConfig: '4d4',
            multiplier: 10
          },
          startingEquipment: {
            id: 'wizard-starting-equipment',
            sets: []
          },
          hitpoint: {
            ability: 'CONSTITUTION',
            dieConfig: '1d6'
          }
        },
        {
          id: 'subclass-scribe',
          label: 'Order of Scribes',
          userId: 'user-1',
          systemId: 'system-1',
          category: CLASS_CATEGORY.SUBCLASS,
          parentClassId: 'class-wizard'
        }
      ],
      backgrounds: [
        {
          kind: SUBJECT.BACKGROUND,
          id: 'background-sage',
          label: 'Sage',
          description: 'A scholarly life.',
          userId: 'user-1',
          systemId: 'system-1',
          details: [
            { id: 'ideal', label: 'Ideal 1', description: 'Knowledge.', order: 2 },
            { id: 'trait', label: 'Personality Trait 1', description: 'Curious.', order: 1 }
          ],
          features: [
            {
              id: 'feature-researcher',
              label: 'Researcher',
              description: 'You know where to look.',
              order: 0,
              details: [
                { id: 'benefit', label: 'Benefit', description: 'Research access.', order: 1 }
              ]
            }
          ],
          startingEquipment: {
            id: 'sage-starting-equipment',
            sets: []
          }
        }
      ],
      equipment: [],
      features: []
    },
    summary: {
      totalLevel: 1,
      abilities: {},
      classes: []
    },
    grants: {
      features: [],
      resources: [],
      spellcasting: []
    },
    chosenGrantChoices: [],
    outstandingChoices: [],
    validations: [],
    readiness: {
      ready: false,
      blockingIssues: [],
      outstandingRequiredChoices: []
    },
    recommendedSectionId: 'RACE',
    ...overrides
  }
}

function createSpellFilteringResolution(
  selectedRaceSpellIds: string[] = []
): CharacterBuilderResolution {
  const baseResolution = createResolution()
  return createResolution({
    catalog: {
      ...baseResolution.catalog,
      spells: [
        {
          id: 'magic-missile',
          label: 'Magic Missile',
          description: '',
          level: 1,
          classIds: ['class-wizard'],
          magicSchoolId: 'evocation',
          castingTime: { unit: 'ROUND', amount: 1 }
        },
        {
          id: 'shield',
          label: 'Shield',
          description: '',
          level: 1,
          classIds: ['class-wizard'],
          magicSchoolId: 'abjuration',
          castingTime: { unit: 'ROUND', amount: 1 }
        }
      ]
    },
    registry: {
      ...baseResolution.registry,
      classes: [
        {
          ...baseResolution.registry.classes[0]!,
          spellcasting: {
            spellLimits: [
              {
                classLevel: 1,
                learnedSpellsLimit: 1,
                slots: [{ spellLevel: 1, slotCount: 1 }]
              }
            ],
            attributes: [],
            ability: 'INTELLIGENCE',
            maxSpellLevel: 1,
            charges: {
              id: 'wizard-spellcasting-charge',
              resetKind: 'LONG_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 1
            }
          }
        }
      ]
    },
    chosenGrantChoices: [
      {
        id: 'race-spell-grant',
        grantId: 'race-spell-grant',
        grantKind: GRANT_KIND.SPELL_GRANT,
        label: 'Innate Magic',
        sourceLabel: 'Dragonborn',
        source: { kind: 'RACE', raceId: 'race-dragonborn' },
        timing: { kind: 'IMMEDIATE' },
        requiredCount: 1,
        duplicatePolicy: 'UNIQUE',
        selectedTargetIds: selectedRaceSpellIds,
        options: [
          { id: 'magic-missile', label: 'Magic Missile' },
          { id: 'shield', label: 'Shield' }
        ]
      }
    ]
  })
}

describe('buildCharacterBuilderView', () => {
  it('offers subclasses only at or above the base class selection level', () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]

    const belowSelectionLevel = buildCharacterBuilderView(character, createResolution())
    expect(belowSelectionLevel.classes.selectedClasses[0]?.subclassOptions).toEqual([])

    character.intent.classes = [{ classId: 'class-wizard', classLevel: 2 }]
    const atSelectionLevel = buildCharacterBuilderView(character, createResolution())
    expect(atSelectionLevel.classes.selectedClasses[0]?.subclassOptions).toEqual([
      { id: 'subclass-scribe', label: 'Order of Scribes' }
    ])
  })

  it('keeps chosen proficiency instructions with the selected class group', () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]
    const baseResolution = createResolution()

    const view = buildCharacterBuilderView(
      character,
      createResolution({
        catalog: {
          ...baseResolution.catalog,
          classes: baseResolution.catalog.classes.map((classRecord) =>
            classRecord.id === 'class-wizard'
              ? {
                  ...classRecord,
                  proficiencyGroups: [
                    {
                      label: 'Skills',
                      entries: ['Choose 2 from Arcana, History, and Insight.'],
                      grantedEntries: []
                    }
                  ]
                }
              : classRecord
          )
        },
        chosenGrantChoices: [
          {
            id: 'choice-skills',
            grantId: 'grant-skills',
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: 'SKILL',
            proficiencyLevel: 'FULL',
            displayCategory: 'SKILLS',
            label: 'Skill Proficiencies',
            sourceLabel: 'Wizard',
            source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
            timing: { kind: 'CLASS_LEVEL', classId: 'class-wizard', classLevel: 1 },
            requiredCount: 2,
            duplicatePolicy: 'UNIQUE',
            selectedTargetIds: [],
            options: [
              { id: 'skill-arcana', label: 'Arcana' },
              { id: 'skill-history', label: 'History' },
              { id: 'skill-insight', label: 'Insight' }
            ]
          }
        ]
      })
    )

    expect(view.classes.selectedClasses[0]?.proficiencyGroups).toEqual([
      {
        category: 'SKILLS',
        label: 'Skills',
        grantedEntries: [],
        choiceInstructions: [
          { label: 'Choose 2 from Arcana, History, and Insight.', required: true }
        ],
        choiceIds: ['choice-skills']
      }
    ])
  })

  it('identifies the attributed class feature that owns subclass selection', () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 2 }]

    const view = buildCharacterBuilderView(
      character,
      createResolution({
        grants: {
          features: [
            {
              id: 'feature-arcane-tradition',
              label: 'Arcane Tradition',
              attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
              sourceLabel: 'Wizard',
              source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 2 }
            },
            {
              id: 'feature-subclass-owned',
              label: 'Subclass Feature',
              attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
              sourceLabel: 'Order of Scribes',
              source: { kind: 'SUBCLASS', subclassId: 'subclass-scribe', classLevel: 2 }
            }
          ],
          resources: [
            {
              id: 'resource-spellcasting',
              label: 'Spellcasting',
              sourceLabel: 'Wizard',
              source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 3 }
            }
          ],
          spellcasting: [
            {
              id: 'spellcasting-wizard',
              label: 'Spellcasting',
              sourceLabel: 'Wizard',
              source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 3 }
            }
          ]
        }
      })
    )

    expect(view.classes.selectedClasses[0]?.subclassSelectionFeatureId).toBe(
      'feature-arcane-tradition'
    )
  })

  it('returns Dragonborn ancestry options when Dragonborn is selected', () => {
    const character = createCharacter()
    character.intent.race = { raceId: 'race-dragonborn' }

    const view = buildCharacterBuilderView(
      character,
      createResolution({
        summary: {
          totalLevel: 1,
          abilities: {},
          selectedRace: {
            raceId: 'race-dragonborn',
            raceLabel: 'Dragonborn',
            ancestryId: 'ancestry-draconic',
            ancestryLabel: 'Draconic Ancestry'
          },
          classes: []
        },
        outstandingChoices: [
          {
            code: 'ANCESTRY_SELECTION_REQUIRED',
            message: 'Choose a Draconic Ancestry option.',
            sourceLabel: 'Draconic Ancestry',
            required: true
          }
        ]
      })
    )

    expect(view.race.ancestry?.label).toBe('Draconic Ancestry')
    expect(view.race.ancestry?.options.map((option) => option.label)).toEqual([
      'Red (Fire)',
      'Blue (Lightning)'
    ])
  })

  it('maps granted features into the owning builder step views', () => {
    const character = createCharacter()
    character.intent.race = { raceId: 'race-dragonborn' }
    character.intent.ancestrySelections = [
      {
        id: 'ancestry-red-selection',
        ancestryId: 'ancestry-draconic',
        optionId: 'ancestry-red',
        source: { kind: 'RACE', raceId: 'race-dragonborn' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    character.intent.classes = [
      {
        classId: 'class-wizard',
        classLevel: 3,
        subclassId: 'subclass-scribe'
      }
    ]
    character.intent.background = { backgroundId: 'background-sage' }

    const view = buildCharacterBuilderView(
      character,
      createResolution({
        summary: {
          totalLevel: 3,
          abilities: {},
          selectedRace: {
            raceId: 'race-dragonborn',
            raceLabel: 'Dragonborn',
            ancestryId: 'ancestry-draconic',
            ancestryLabel: 'Draconic Ancestry',
            ancestryOptionId: 'ancestry-red',
            ancestryOptionLabel: 'Red (Fire)'
          },
          selectedBackground: {
            backgroundId: 'background-sage',
            label: 'Sage'
          },
          classes: [
            {
              classId: 'class-wizard',
              classLabel: 'Wizard',
              classLevel: 3,
              subclassId: 'subclass-scribe',
              subclassLabel: 'Order of Scribes',
              featureLabels: ['Spellcasting', 'Awakened Quill'],
              resourceLabels: [],
              spellcastingLabels: ['Wizard Spells']
            }
          ]
        },
        grants: {
          features: [
            {
              id: 'feature-draconic-ancestry',
              label: 'Draconic Ancestry',
              sourceLabel: 'Dragonborn',
              source: { kind: 'RACE', raceId: 'race-dragonborn' }
            },
            {
              id: 'feature-breath-weapon',
              label: 'Breath Weapon',
              sourceLabel: 'Red (Fire)',
              source: {
                kind: 'ANCESTRY',
                ancestryId: 'ancestry-draconic',
                optionId: 'ancestry-red'
              }
            },
            {
              id: 'feature-spellcasting',
              label: 'Spellcasting',
              sourceLabel: 'Wizard',
              source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 3 }
            },
            {
              id: 'feature-awakened-quill',
              label: 'Awakened Quill',
              sourceLabel: 'Order of Scribes',
              source: { kind: 'SUBCLASS', subclassId: 'subclass-scribe', classLevel: 3 }
            },
            {
              id: 'feature-researcher',
              label: 'Researcher',
              sourceLabel: 'Sage',
              source: { kind: 'BACKGROUND', backgroundId: 'background-sage' }
            }
          ],
          resources: [],
          spellcasting: []
        }
      })
    )

    expect(view.race.features.map((feature) => feature.label)).toEqual([
      'Draconic Ancestry',
      'Breath Weapon'
    ])
    expect(view.classes.selectedClasses[0]?.features.map((feature) => feature.label)).toEqual([
      'Awakened Quill',
      'Spellcasting'
    ])
    expect(view.background.features.map((feature) => feature.label)).toEqual(['Researcher'])
    expect(view.background.features[0]?.details).toEqual([
      { id: 'benefit', label: 'Benefit', description: 'Research access.' }
    ])
    expect(view.background.description).toBe('A scholarly life.')
    expect(view.background.detailSections.map((section) => section.label)).toEqual([
      'Personality Traits',
      'Ideals'
    ])
  })

  it('offers two distinct non-Charisma ability options for Half-Elf', () => {
    const character = createCharacter()
    character.intent.race = { raceId: 'race-half-elf' }

    const view = buildCharacterBuilderView(
      character,
      createResolution({
        summary: {
          totalLevel: 1,
          abilities: { CHARISMA: 12 },
          selectedRace: {
            raceId: 'race-half-elf',
            raceLabel: 'Half-Elf'
          },
          classes: []
        },
        grants: {
          features: [
            {
              id: 'feature-half-elf-ability-score-increase',
              label: 'Ability Score Increase',
              sourceLabel: 'Half-Elf',
              source: { kind: 'RACE', raceId: 'race-half-elf' }
            }
          ],
          resources: [],
          spellcasting: []
        }
      })
    )

    expect(view.race.featureChoices).toEqual([
      expect.objectContaining({
        featureId: 'feature-half-elf-ability-score-increase',
        requiredCount: 2,
        selectedOptionIds: [],
        options: [
          { id: 'option-strength', label: 'Strength' },
          { id: 'option-dexterity', label: 'Dexterity' },
          { id: 'option-constitution', label: 'Constitution' },
          { id: 'option-intelligence', label: 'Intelligence' },
          { id: 'option-wisdom', label: 'Wisdom' }
        ]
      })
    ])
  })

  it('keeps race spell grant options selected by a class visible with their source', () => {
    const character = createCharacter()
    character.intent.race = { raceId: 'race-dragonborn' }
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: 'class-wizard', classLevel: 1 },
        spells: ['magic-missile']
      }
    ]

    const view = buildCharacterBuilderView(character, createSpellFilteringResolution())

    expect(view.race.grantChoices[0]?.options).toEqual([
      {
        id: 'magic-missile',
        label: 'Magic Missile',
        disabled: true,
        disabledReason: 'Granted by Wizard'
      },
      { id: 'shield', label: 'Shield' }
    ])
    expect(
      view.classes.selectedClasses[0]?.spellChoices[0]?.spellOptions.map((option) => option.id)
    ).toEqual(['magic-missile', 'shield'])
  })

  it('includes spells explicitly owned by a class spell list alongside legacy spell class links', () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]
    const resolution = createSpellFilteringResolution()
    const wizard = resolution.registry.classes[0]
    if (!wizard?.spellcasting) throw new Error('Expected Wizard spellcasting fixture.')
    wizard.spellcasting.availableSpellIds = ['shield']
    const shield = resolution.catalog.spells.find((spell) => spell.id === 'shield')
    if (!shield) throw new Error('Expected Shield spell fixture.')
    shield.classIds = []

    const view = buildCharacterBuilderView(character, resolution)

    expect(
      view.classes.selectedClasses[0]?.spellChoices[0]?.spellOptions.map((option) => option.id)
    ).toEqual(['magic-missile', 'shield'])
  })

  it('preserves disabled proficiency options supplied by the Builder resolver', () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]

    const view = buildCharacterBuilderView(
      character,
      createResolution({
        chosenGrantChoices: [
          {
            id: 'wizard-skill-choice',
            grantId: 'wizard-skill-grant',
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: 'SKILL',
            proficiencyLevel: 'FULL',
            label: 'Skill Proficiencies',
            sourceLabel: 'Wizard',
            source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
            timing: { kind: 'CLASS_LEVEL', classId: 'class-wizard', classLevel: 1 },
            requiredCount: 1,
            duplicatePolicy: 'UNIQUE',
            selectedTargetIds: [],
            options: [
              {
                id: 'skill-insight',
                label: 'Insight',
                disabled: true,
                disabledReason: 'Granted by Sage'
              },
              { id: 'skill-arcana', label: 'Arcana' }
            ]
          }
        ]
      })
    )

    expect(view.classes.selectedClasses[0]?.grantChoices[0]?.options).toEqual([
      expect.objectContaining({
        id: 'skill-insight',
        label: 'Insight',
        disabled: true,
        disabledReason: 'Granted by Sage'
      }),
      expect.objectContaining({ id: 'skill-arcana', label: 'Arcana' })
    ])
  })

  it('keeps class spell options selected by a race grant visible with their source', () => {
    const character = createCharacter()
    character.intent.race = { raceId: 'race-dragonborn' }
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]

    const view = buildCharacterBuilderView(
      character,
      createSpellFilteringResolution(['magic-missile'])
    )

    expect(view.race.grantChoices[0]?.options.map((option) => option.id)).toEqual([
      'magic-missile',
      'shield'
    ])
    expect(view.classes.selectedClasses[0]?.spellChoices[0]?.spellOptions).toEqual([
      expect.objectContaining({
        id: 'magic-missile',
        disabled: true,
        disabledReason: 'Granted by Dragonborn'
      }),
      expect.objectContaining({ id: 'shield' })
    ])
  })

  it('retains duplicate spell selections in both controls so either source can clear it', () => {
    const character = createCharacter()
    character.intent.race = { raceId: 'race-dragonborn' }
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]
    character.intent.spellSelections = [
      {
        id: 'wizard-spells',
        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: 'class-wizard', classLevel: 1 },
        spells: ['magic-missile']
      }
    ]

    const view = buildCharacterBuilderView(
      character,
      createSpellFilteringResolution(['magic-missile'])
    )

    expect(view.race.grantChoices[0]?.options.map((option) => option.id)).toEqual([
      'magic-missile',
      'shield'
    ])
    expect(
      view.classes.selectedClasses[0]?.spellChoices[0]?.spellOptions.map((option) => option.id)
    ).toEqual(['magic-missile', 'shield'])
  })

  it('provides a player-facing label for property-based starting equipment choices', () => {
    const character = createCharacter()
    character.intent.classes = [{ classId: 'class-wizard', classLevel: 1 }]
    const resolution = createResolution()
    const wizard = resolution.registry.classes[0]
    if (!wizard || wizard.category !== CLASS_CATEGORY.BASE)
      throw new Error('Wizard fixture is missing.')
    wizard.startingEquipment = {
      id: 'wizard-starting-equipment',
      sets: [
        {
          id: 'wizard-set',
          order: 1,
          groups: [
            {
              id: 'instrument-group',
              order: 1,
              options: [
                {
                  id: 'instrument-option',
                  order: 1,
                  items: [
                    {
                      id: 'instrument-choice',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT',
                      selectionKind: 'CHOSEN',
                      count: 1,
                      authoringModeKind: 'ALL',
                      properties: ['MUSICAL_INSTRUMENT']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
    resolution.catalog.equipment = [
      {
        id: 'equipment-lute',
        label: 'Lute',
        category: 'TOOL',
        properties: ['MUSICAL_INSTRUMENT'],
        isContainer: false,
        requiresAttunement: false
      }
    ]

    const view = buildCharacterBuilderView(character, resolution)

    expect(view.equipment.classStartingEquipment?.choiceLabels).toEqual({
      'instrument-choice': 'Any musical instrument'
    })
  })
})
