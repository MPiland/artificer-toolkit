import { describe, expect, it } from 'vitest'
import {
  applyClassChoiceEligibility,
  buildBackgroundSelectionGroups,
  buildClassSelectionGroups,
  buildRaceSelectionGroups
} from './characterSelectionOptions'

describe('character selection options', () => {
  it('renders race ability increases as direct fact rows', () => {
    const groups = buildRaceSelectionGroups(
      [
        {
          id: 'race-dragonborn',
          label: 'Dragonborn',
          category: 'BASE',
          selectionMode: 'DIRECT',
          sizeLabel: 'Medium',
          speedLabels: ['Walking Speed 30 ft'],
          abilityScoreIncreaseFacts: [
            { label: 'Strength', value: '+2' },
            { label: 'Charisma', value: '+1' }
          ]
        }
      ],
      []
    )

    expect(groups[0]?.options[0]?.details).toEqual([
      { label: 'Size', value: 'Medium', prominence: 'primary' },
      { label: 'Speed', value: 'Walking Speed 30 ft', prominence: 'primary' },
      { label: 'Strength', value: '+2' },
      { label: 'Charisma', value: '+1' }
    ])
  })

  it('builds sorted background comparison cards from backend references', () => {
    const groups = buildBackgroundSelectionGroups(
      [
        {
          id: 'background-sage',
          label: 'Sage',
          description: '<p>A dedicated scholar.</p>',
          summary: 'A dedicated scholar.',
          grantFacts: [{ label: 'Skills', value: 'Arcana, History' }],
          featureLabels: ['Researcher'],
          hiddenGrantFactCount: 0,
          hiddenFeatureCount: 0
        },
        {
          id: 'background-acolyte',
          label: 'Acolyte',
          description: '<p>A devoted servant of a temple.</p>',
          summary: 'A devoted servant of a temple.',
          grantFacts: [{ label: 'Languages', value: 'Choose 2' }],
          featureLabels: ['Shelter of the Faithful'],
          hiddenGrantFactCount: 1,
          hiddenFeatureCount: 1
        }
      ],
      [
        { id: 'background-sage', label: 'Sage' },
        { id: 'background-acolyte', label: 'Acolyte' }
      ]
    )

    expect(groups[0]?.options.map((option) => option.label)).toEqual(['Acolyte', 'Sage'])
    expect(groups[0]?.options[0]).toMatchObject({
      description: 'A devoted servant of a temple.',
      details: [
        {
          label: 'Feature',
          value: 'Shelter of the Faithful Â· 1 more',
          prominence: 'primary'
        },
        { label: 'Languages', value: 'Choose 2' },
        { label: 'Additional grants', value: '1 more' }
      ]
    })
  })

  it('groups subraces beneath a non-selectable parent and sorts the leaf cards', () => {
    const groups = buildRaceSelectionGroups(
      [
        {
          id: 'race-elf',
          label: 'Elf',
          category: 'BASE',
          selectionMode: 'REQUIRES_SUBRACE',
          speedLabels: [],
          abilityScoreIncreaseFacts: []
        },
        {
          id: 'race-wood-elf',
          label: 'Wood Elf',
          category: 'SUBRACE',
          parentRaceId: 'race-elf',
          speedLabels: [],
          abilityScoreIncreaseFacts: []
        },
        {
          id: 'race-high-elf',
          label: 'High Elf',
          category: 'SUBRACE',
          parentRaceId: 'race-elf',
          speedLabels: [],
          abilityScoreIncreaseFacts: []
        }
      ],
      []
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Elf subraces')
    expect(groups[0]?.options.map((option) => option.label)).toEqual(['High Elf', 'Wood Elf'])
    expect(groups[0]?.options.some((option) => option.id === 'race-elf')).toBe(false)
  })

  it('keeps a direct base race selectable when it has optional subraces', () => {
    const groups = buildRaceSelectionGroups(
      [
        {
          id: 'race-human',
          label: 'Human',
          category: 'BASE',
          selectionMode: 'DIRECT',
          speedLabels: [],
          abilityScoreIncreaseFacts: []
        },
        {
          id: 'race-variant-human',
          label: 'Variant Human',
          category: 'SUBRACE',
          parentRaceId: 'race-human',
          speedLabels: [],
          abilityScoreIncreaseFacts: []
        }
      ],
      []
    )

    expect(groups).toEqual([
      expect.objectContaining({
        id: 'direct-races',
        label: 'Races',
        options: [expect.objectContaining({ id: 'race-human', label: 'Human' })]
      })
    ])
  })

  it('sorts class cards and preserves disabled reasons', () => {
    const groups = buildClassSelectionGroups(
      [
        {
          id: 'class-wizard',
          label: 'Wizard',
          category: 'BASE',
          savingThrowLabels: [],
          proficiencyGroups: []
        },
        {
          id: 'class-bard',
          label: 'Bard',
          category: 'BASE',
          savingThrowLabels: [],
          proficiencyGroups: []
        }
      ],
      [
        { id: 'class-wizard', label: 'Wizard' },
        { id: 'class-bard', label: 'Bard', disabled: true, disabledReason: 'Already selected.' }
      ]
    )

    expect(groups[0]?.options.map((option) => option.label)).toEqual(['Bard', 'Wizard'])
    expect(groups[0]?.options[0]).toMatchObject({
      disabled: true,
      disabledReason: 'Already selected.'
    })
  })

  it('renders class proficiencies as separate SRD-style detail groups', () => {
    const groups = buildClassSelectionGroups(
      [
        {
          id: 'class-fighter',
          label: 'Fighter',
          category: 'BASE',
          requirementGroups: {
            groups: [
              {
                id: 'fighter-requirements',
                requirements: [{ id: 'fighter-strength', ability: 'STRENGTH', min: 13 }]
              }
            ]
          },
          savingThrowLabels: ['Strength', 'Constitution'],
          proficiencyGroups: [
            { label: 'Armor', entries: ['Light armor', 'Medium armor', 'Shields'] },
            { label: 'Weapons', entries: ['Simple weapons', 'Martial weapons'] },
            { label: 'Skills', entries: ['Choose 2 from Acrobatics, Animal Handling'] }
          ]
        }
      ],
      [{ id: 'class-fighter', label: 'Fighter' }]
    )

    expect(groups[0]?.options[0]?.details).toEqual([
      { label: 'Saving throws', value: 'Strength, Constitution', prominence: 'primary' },
      { label: 'Multiclass requirements', value: 'Strength 13', status: 'default' },
      { label: 'Armor', value: 'Light armor, Medium armor, Shields' },
      { label: 'Weapons', value: 'Simple weapons, Martial weapons' },
      { label: 'Skills', value: 'Choose 2 from Acrobatics, Animal Handling' }
    ])
  })

  it('allows the first class but requires complete qualifying scores for multiclass choices', () => {
    const references = [
      {
        id: 'class-fighter',
        label: 'Fighter',
        category: 'BASE',
        requirementGroups: {
          groups: [
            {
              id: 'fighter-requirements',
              requirements: [{ id: 'fighter-strength', ability: 'STRENGTH' as const, min: 13 }]
            }
          ]
        }
      },
      {
        id: 'class-wizard',
        label: 'Wizard',
        category: 'BASE',
        requirementGroups: {
          groups: [
            {
              id: 'wizard-requirements',
              requirements: [
                { id: 'wizard-intelligence', ability: 'INTELLIGENCE' as const, min: 13 }
              ]
            }
          ]
        }
      }
    ]
    const choices = references.map(({ id, label }) => ({ id, label }))

    expect(
      applyClassChoiceEligibility({
        abilityScores: {},
        choices,
        currentClassIds: [],
        references
      }).every((choice) => !choice.disabled)
    ).toBe(true)

    const incomplete = applyClassChoiceEligibility({
      abilityScores: {},
      choices,
      currentClassIds: ['class-wizard'],
      references
    })
    expect(incomplete.find((choice) => choice.id === 'class-fighter')).toMatchObject({
      disabled: true,
      disabledReason: 'Requires Intelligence 13 (Not met)'
    })

    const eligible = applyClassChoiceEligibility({
      abilityScores: {
        STRENGTH: 13,
        DEXTERITY: 10,
        CONSTITUTION: 12,
        INTELLIGENCE: 15,
        WISDOM: 14,
        CHARISMA: 8
      },
      choices,
      currentClassIds: ['class-wizard'],
      references
    })
    expect(eligible.find((choice) => choice.id === 'class-fighter')?.disabled).toBeUndefined()
  })
})
