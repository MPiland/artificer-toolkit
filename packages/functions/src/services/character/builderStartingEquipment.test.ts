import { describe, expect, it } from 'vitest'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared/subjects/authored'
import type { StartingEquipmentAuthored } from '@artificer-toolkit/shared/authored'
import { isStartingEquipmentDecisionComplete } from './builderStartingEquipment.js'
import type { CharacterBuilderCatalog } from './builderCatalog.js'

function createCatalog(): CharacterBuilderCatalog {
  return {
    races: [{ id: 'dragonborn', label: 'Dragonborn', category: 'BASE' }],
    classes: [],
    backgrounds: [],
    equipment: [],
    feats: [],
    spells: [
      {
        id: 'magic-missile',
        label: 'Magic Missile',
        description: '',
        level: 1,
        classIds: ['wizard'],
        magicSchoolId: 'evocation',
        castingTime: { unit: 'ROUND', amount: 1 }
      }
    ]
  }
}

function createChoiceStartingEquipment(count = 1): StartingEquipmentAuthored {
  return {
    id: 'fighter-start',
    sets: [
      {
        id: 'fighter-set',
        order: 1,
        groups: [
          {
            id: 'fighter-group',
            order: 1,
            options: [
              {
                id: 'fighter-option',
                order: 1,
                items: [
                  {
                    id: 'martial-weapon-choice',
                    order: 1,
                    startingEquipmentKind: 'EQUIPMENT',
                    category: 'WEAPON',
                    selectionKind: 'CHOSEN',
                    count,
                    authoringModeKind: 'SELECTED',
                    equipmentIds: ['longsword']
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}

describe('character builder starting equipment decisions', () => {
  it('rejects starting equipment selections outside the chosen item allow-list', () => {
    const catalog = createCatalog()
    catalog.equipment = [
      {
        id: 'longsword',
        label: 'Longsword',
        category: 'WEAPON',
        isContainer: false,
        properties: ['MARTIAL'],
        requiresAttunement: false
      },
      {
        id: 'dagger',
        label: 'Dagger',
        category: 'WEAPON',
        isContainer: false,
        properties: ['SIMPLE'],
        requiresAttunement: false
      }
    ]
    const startingEquipment = createChoiceStartingEquipment()
    const validDecision = {
      source: CharacterStartingEquipmentSource.CLASS,
      tookGold: false,
      groups: [
        {
          groupId: 'fighter-group',
          optionId: 'fighter-option',
          selections: [
            {
              selectionKey: 'martial-weapon-choice',
              equipmentId: 'longsword',
              quantity: 1
            }
          ]
        }
      ]
    }
    const invalidDecision = {
      ...validDecision,
      groups: [
        {
          groupId: 'fighter-group',
          optionId: 'fighter-option',
          selections: [
            {
              selectionKey: 'martial-weapon-choice',
              equipmentId: 'dagger',
              quantity: 1
            }
          ]
        }
      ]
    }

    expect(isStartingEquipmentDecisionComplete(startingEquipment, validDecision, catalog)).toBe(
      true
    )
    expect(isStartingEquipmentDecisionComplete(startingEquipment, invalidDecision, catalog)).toBe(
      false
    )
  })

  it('accepts chosen starting equipment represented as a single row with matching quantity', () => {
    const catalog = createCatalog()
    catalog.equipment = [
      {
        id: 'longsword',
        label: 'Longsword',
        category: 'WEAPON',
        isContainer: false,
        properties: ['MARTIAL'],
        requiresAttunement: false
      }
    ]
    const startingEquipment = createChoiceStartingEquipment(2)

    expect(
      isStartingEquipmentDecisionComplete(
        startingEquipment,
        {
          source: CharacterStartingEquipmentSource.CLASS,
          tookGold: false,
          groups: [
            {
              groupId: 'fighter-group',
              optionId: 'fighter-option',
              selections: [
                {
                  selectionKey: 'martial-weapon-choice',
                  equipmentId: 'longsword',
                  quantity: 2
                }
              ]
            }
          ]
        },
        catalog
      )
    ).toBe(true)
  })

  it('requires a concrete total when starting gold is selected', () => {
    const catalog = createCatalog()
    const startingEquipment = createChoiceStartingEquipment()
    const incompleteGoldDecision = {
      source: CharacterStartingEquipmentSource.CLASS,
      tookGold: true,
      gold: {
        goldOption: '5d4',
        totalGold: 0
      }
    }
    const completeGoldDecision = {
      ...incompleteGoldDecision,
      gold: {
        goldOption: '5d4',
        totalGold: 120
      }
    }

    expect(
      isStartingEquipmentDecisionComplete(startingEquipment, incompleteGoldDecision, catalog)
    ).toBe(false)
    expect(
      isStartingEquipmentDecisionComplete(startingEquipment, completeGoldDecision, catalog)
    ).toBe(true)
  })
})
