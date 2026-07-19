import { describe, expect, it } from 'vitest'

import { createEmptyCharacterAuthored, type CharacterBuilderResolution } from './builderService.js'
import { CLASS_CATEGORY, RACE_CATEGORY_CODE, SUBJECT } from '@artificer-toolkit/shared/core'
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
      backgrounds: [{ id: 'background-sage', label: 'Sage' }],
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
          userId: 'user-1',
          systemId: 'system-1',
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
      'Spellcasting',
      'Awakened Quill'
    ])
    expect(view.background.features.map((feature) => feature.label)).toEqual(['Researcher'])
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
})
