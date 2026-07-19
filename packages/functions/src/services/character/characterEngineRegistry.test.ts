import { describe, expect, it } from 'vitest'

import { CLASS_CATEGORY } from '@artificer-toolkit/shared/core'

import type { CharacterBuilderRegistry } from './builderService.js'
import { createCharacterAssemblyRegistry } from './characterEngine.js'

describe('createCharacterAssemblyRegistry', () => {
  it('includes features embedded in authored subjects', () => {
    const registry: CharacterBuilderRegistry = {
      system: null,
      races: [],
      classes: [
        {
          id: 'fighter',
          label: 'Fighter',
          category: CLASS_CATEGORY.BASE,
          userId: 'owner',
          systemId: 'system',
          startingGold: {
            currencyId: 'gp',
            dieConfig: '5d4',
            multiplier: 10
          },
          startingEquipment: {
            id: 'fighter-equipment',
            sets: []
          },
          hitpoint: {
            ability: 'CONSTITUTION',
            dieConfig: '1d10'
          },
          multiclass: {
            id: 'fighter-multiclass',
            requirementGroups: {
              groups: []
            }
          },
          features: [
            {
              id: 'second-wind',
              label: 'Second Wind',
              description: 'Recover hit points.',
              order: 1
            }
          ]
        }
      ],
      backgrounds: [],
      equipment: [],
      feats: [],
      features: []
    }

    const assembled = createCharacterAssemblyRegistry(registry)

    expect(assembled.features['second-wind']).toBeDefined()
    expect(assembled.spells).toEqual({})
  })
})
