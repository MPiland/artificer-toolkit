import { createStartingEquipmentDecision } from './startingEquipment'
import {
  type ChosenStartingEquipmentItem,
  ensureDefaultStartingEquipmentGroupOptions,
  formatStartingEquipmentItem,
  formatStartingEquipmentItems,
  getStartingEquipmentItemOptions,
  getStartingEquipmentSelections,
  setStartingEquipmentGoldTotal,
  setStartingEquipmentGroupOption,
  setStartingEquipmentMode,
  setStartingEquipmentSelections
} from './startingEquipmentChoices'
import type { CharacterBuilderChoiceOptionDto } from '@artificer-toolkit/schema/api/characters'

describe('CharacterStartingEquipmentChoices utils', () => {
  it('stores repeated equipment picks as quantities and expands them for rendering', () => {
    const decision = setStartingEquipmentGroupOption(
      createStartingEquipmentDecision('CLASS'),
      'fighter-group',
      'fighter-option'
    )

    const nextDecision = setStartingEquipmentSelections(
      decision,
      'fighter-group',
      'martial-weapon-choice',
      ['longsword', 'longsword', 'battleaxe']
    )

    expect(nextDecision.groups?.[0]?.selections).toEqual([
      {
        selectionKey: 'martial-weapon-choice',
        equipmentId: 'longsword',
        quantity: 2
      },
      {
        selectionKey: 'martial-weapon-choice',
        equipmentId: 'battleaxe',
        quantity: 1
      }
    ])
    expect(
      getStartingEquipmentSelections(nextDecision, 'fighter-group', 'martial-weapon-choice')
    ).toEqual(['longsword', 'longsword', 'battleaxe'])
  })

  it('formats selected equipment requirements from explicit options and item facets', () => {
    const equipmentOptions: CharacterBuilderChoiceOptionDto[] = [
      { id: 'prayer-book', label: 'Prayer Book' },
      { id: 'prayer-wheel', label: 'Prayer Wheel' }
    ]

    expect(
      formatStartingEquipmentItem(
        {
          id: 'devotional-choice',
          order: 1,
          startingEquipmentKind: 'EQUIPMENT',
          selectionKind: 'CHOSEN',
          count: 1,
          authoringModeKind: 'SELECTED',
          equipmentIds: ['prayer-book', 'prayer-wheel']
        },
        equipmentOptions,
        []
      )
    ).toBe('Choose 1 Prayer Book or Prayer Wheel')
    expect(
      formatStartingEquipmentItem(
        {
          id: 'martial-melee-choice',
          order: 1,
          startingEquipmentKind: 'EQUIPMENT',
          category: 'WEAPON',
          properties: ['MARTIAL', 'MELEE'],
          selectionKind: 'CHOSEN',
          count: 1
        },
        equipmentOptions,
        []
      )
    ).toBe('Choose 1 martial melee weapon')
    expect(
      formatStartingEquipmentItem(
        {
          id: 'included-greataxe',
          order: 1,
          startingEquipmentKind: 'EQUIPMENT',
          selectionKind: 'GRANTED',
          quantity: 1,
          authoringModeKind: 'SELECTED',
          equipmentIds: ['greataxe']
        },
        [{ id: 'greataxe', label: 'Greataxe' }],
        []
      )
    ).toBe('Greataxe')
  })

  it('formats fixed equipment as a natural-language list', () => {
    expect(
      formatStartingEquipmentItems(
        [
          {
            id: 'explorers-pack',
            order: 1,
            startingEquipmentKind: 'EQUIPMENT',
            selectionKind: 'GRANTED',
            quantity: 1,
            authoringModeKind: 'SELECTED',
            equipmentIds: ['explorers-pack']
          },
          {
            id: 'javelins',
            order: 2,
            startingEquipmentKind: 'EQUIPMENT',
            selectionKind: 'GRANTED',
            quantity: 4,
            authoringModeKind: 'SELECTED',
            equipmentIds: ['javelin']
          }
        ],
        [
          { id: 'explorers-pack', label: "Explorer's Pack" },
          { id: 'javelin', label: 'Javelin' }
        ],
        []
      )
    ).toBe("Explorer's Pack and 4 Javelins")
  })

  it('defaults single-option starting equipment groups without making the user choose the obvious option', () => {
    const decision = createStartingEquipmentDecision('CLASS')
    const nextDecision = ensureDefaultStartingEquipmentGroupOptions(decision, {
      id: 'barbarian-starting-equipment',
      sets: [
        {
          id: 'barbarian-set',
          order: 1,
          groups: [
            {
              id: 'barbarian-group',
              order: 1,
              options: [
                {
                  id: 'barbarian-option',
                  order: 1,
                  items: []
                }
              ]
            }
          ]
        }
      ]
    })

    expect(nextDecision.groups).toEqual([
      {
        groupId: 'barbarian-group',
        optionId: 'barbarian-option',
        selections: []
      }
    ])
  })

  it('clears item selections when eligibility changes the only available option', () => {
    const decision = {
      ...createStartingEquipmentDecision('CLASS'),
      groups: [
        {
          groupId: 'cleric-weapon',
          optionId: 'warhammer',
          selections: [
            {
              selectionKey: 'weapon-choice',
              equipmentId: 'warhammer',
              quantity: 1
            }
          ]
        }
      ]
    }

    const nextDecision = ensureDefaultStartingEquipmentGroupOptions(decision, {
      id: 'cleric-starting-equipment',
      sets: [
        {
          id: 'cleric-set',
          order: 1,
          groups: [
            {
              id: 'cleric-weapon',
              order: 1,
              options: [
                {
                  id: 'mace',
                  order: 1,
                  items: []
                }
              ]
            }
          ]
        }
      ]
    })

    expect(nextDecision.groups).toEqual([
      {
        groupId: 'cleric-weapon',
        optionId: 'mace',
        selections: []
      }
    ])
  })

  it('filters chosen equipment options by allow-list, category, and properties', () => {
    const item = {
      id: 'martial-weapon-choice',
      order: 1,
      startingEquipmentKind: 'EQUIPMENT',
      category: 'WEAPON',
      properties: ['MARTIAL'],
      selectionKind: 'CHOSEN',
      count: 1,
      authoringModeKind: 'SELECTED',
      equipmentIds: ['longsword', 'dagger', 'chain-mail']
    } satisfies ChosenStartingEquipmentItem
    const equipmentOptions: CharacterBuilderChoiceOptionDto[] = [
      {
        id: 'longsword',
        label: 'Longsword',
        category: 'WEAPON',
        properties: ['MARTIAL']
      },
      {
        id: 'dagger',
        label: 'Dagger',
        category: 'WEAPON',
        properties: ['SIMPLE']
      },
      {
        id: 'chain-mail',
        label: 'Chain Mail',
        category: 'ARMOR',
        properties: ['MARTIAL']
      },
      {
        id: 'halberd',
        label: 'Halberd',
        category: 'WEAPON',
        properties: ['MARTIAL']
      }
    ]

    expect(getStartingEquipmentItemOptions(item, equipmentOptions)).toEqual([
      {
        value: 'longsword',
        label: 'Longsword',
        disabled: undefined
      }
    ])
  })

  it('supports switching to starting gold while preserving equipment choices off-path', () => {
    const startingGold = {
      dieConfig: '5d4',
      multiplier: 10,
      currencyId: 'gp'
    }
    const groupDecision = setStartingEquipmentGroupOption(
      createStartingEquipmentDecision('CLASS'),
      'fighter-group',
      'fighter-option'
    )
    const equipmentDecision = setStartingEquipmentSelections(
      groupDecision,
      'fighter-group',
      'martial-weapon-choice',
      ['longsword']
    )
    const goldModeDecision = setStartingEquipmentMode(
      equipmentDecision,
      'CLASS',
      'GOLD',
      startingGold
    )
    const goldDecision = setStartingEquipmentGoldTotal(goldModeDecision, 'CLASS', startingGold, 120)

    expect(goldDecision).toMatchObject({
      tookGold: true,
      gold: {
        goldOption: '5d4',
        totalGold: 120
      },
      groups: equipmentDecision.groups
    })
    expect(
      setStartingEquipmentMode(goldDecision, 'CLASS', 'EQUIPMENT', startingGold)
    ).toMatchObject({
      tookGold: false,
      gold: undefined,
      groups: equipmentDecision.groups
    })
  })
})
