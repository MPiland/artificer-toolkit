import { createStartingEquipmentDecision } from '../characterBuilder.utils'
import {
  type ChosenStartingEquipmentItem,
  getStartingEquipmentItemOptions,
  getStartingEquipmentSelections,
  setStartingEquipmentGroupOption,
  setStartingEquipmentSelections
} from '../steps/CharacterStartingEquipmentChoices.utils'
import type { CharacterBuilderChoiceOptionDto } from '@artificer-toolkit/schema/api/characters'

describe('CharacterStartingEquipmentChoices utils', () => {
  it('stores repeated equipment picks as quantities and expands them for rendering', () => {
    const decision = setStartingEquipmentGroupOption(createStartingEquipmentDecision('CLASS'), 'fighter-group', 'fighter-option')

    const nextDecision = setStartingEquipmentSelections(decision, 'fighter-group', 'martial-weapon-choice', ['longsword', 'longsword', 'battleaxe'])

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
    expect(getStartingEquipmentSelections(nextDecision, 'fighter-group', 'martial-weapon-choice')).toEqual([
      'longsword',
      'longsword',
      'battleaxe'
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
})
