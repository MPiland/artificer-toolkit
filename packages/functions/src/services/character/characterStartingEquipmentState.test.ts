import { describe, expect, it } from 'vitest'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared/subjects/authored'
import { createEmptyCharacterAuthored } from './builderService.js'
import { materializeCharacterStartingEquipment } from './characterStartingEquipmentState.js'

describe('Character starting equipment state', () => {
  it('materializes class gold and background equipment once', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'system-1',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    character.intent.startingEquipment = {
      class: {
        source: CharacterStartingEquipmentSource.CLASS,
        tookGold: true,
        gold: { goldOption: '4d4', totalGold: 100 }
      },
      background: {
        source: CharacterStartingEquipmentSource.BACKGROUND,
        tookGold: false,
        groups: [
          {
            groupId: 'background-group',
            optionId: 'background-option',
            selections: [
              { selectionKey: 'holy-symbol-choice', equipmentId: 'holy-symbol', quantity: 1 }
            ]
          }
        ]
      }
    }
    const backgroundStartingEquipment = {
      id: 'background-equipment',
      sets: [
        {
          id: 'background-set',
          order: 0,
          groups: [
            {
              id: 'background-group',
              order: 0,
              options: [
                {
                  id: 'background-option',
                  order: 0,
                  items: [
                    {
                      id: 'robes',
                      order: 0,
                      startingEquipmentKind: 'EQUIPMENT' as const,
                      selectionKind: 'GRANTED' as const,
                      authoringModeKind: 'SELECTED' as const,
                      equipmentIds: ['robes'],
                      quantity: 1
                    },
                    {
                      id: 'holy-symbol-choice',
                      order: 1,
                      startingEquipmentKind: 'EQUIPMENT' as const,
                      selectionKind: 'CHOSEN' as const,
                      authoringModeKind: 'SELECTED' as const,
                      equipmentIds: ['holy-symbol', 'holy-emblem'],
                      count: 1
                    },
                    {
                      id: 'background-coins',
                      order: 2,
                      startingEquipmentKind: 'CURRENCY' as const,
                      currencies: [{ currencyId: 'gp', amount: 15 }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    const first = materializeCharacterStartingEquipment(character, {
      classStartingEquipment: { id: 'class-equipment', sets: [] },
      classStartingGold: { currencyId: 'gp', dieConfig: '4d4', multiplier: 10 },
      backgroundStartingEquipment
    })

    expect(first.changed).toBe(true)
    expect(first.character.state.equipment.inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ equipmentId: 'robes', quantity: 1 }),
        expect.objectContaining({ equipmentId: 'holy-symbol', quantity: 1 })
      ])
    )
    expect(first.character.state.currency[0]?.currencies).toEqual([
      { currencyId: 'gp', amount: 115 }
    ])
    expect(first.character.intent.startingEquipment?.class?.applied).toBe(true)
    expect(first.character.intent.startingEquipment?.background?.applied).toBe(true)

    const second = materializeCharacterStartingEquipment(first.character, {
      classStartingEquipment: { id: 'class-equipment', sets: [] },
      classStartingGold: { currencyId: 'gp', dieConfig: '4d4', multiplier: 10 },
      backgroundStartingEquipment
    })
    expect(second.changed).toBe(false)
    expect(second.character).toEqual(first.character)
  })
})
