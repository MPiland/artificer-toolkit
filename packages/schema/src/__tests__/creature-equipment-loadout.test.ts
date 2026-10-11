import { describe, expect, it } from 'vitest'

import { creatureAuthoredDtoSchema } from '../subjects/creature.js'

const ids = {
  creature: '00000000-0000-4000-8000-000000000001',
  system: '00000000-0000-4000-8000-000000000002',
  user: '00000000-0000-4000-8000-000000000003',
  loadout: '00000000-0000-4000-8000-000000000004',
  equipment: '00000000-0000-4000-8000-000000000005',
  feature: '00000000-0000-4000-8000-000000000006'
}

function creature(loadout: unknown, features: unknown[] = []) {
  return {
    id: ids.creature,
    label: 'Loadout Test Creature',
    userId: ids.user,
    systemId: ids.system,
    category: 'MONSTER',
    creatureTypeId: '00000000-0000-4000-8000-000000000007',
    size: 'MEDIUM',
    abilityScores: {
      STRENGTH: 10,
      DEXTERITY: 10,
      CONSTITUTION: 10,
      INTELLIGENCE: 10,
      WISDOM: 10,
      CHARISMA: 10
    },
    armorClass: 10,
    hitPoints: 10,
    speeds: [],
    features,
    equipmentLoadout: loadout
  }
}

describe('Creature equipment loadout contract', () => {
  it('rejects malformed identity, held stacks, and duplicate occurrences', () => {
    expect(
      creatureAuthoredDtoSchema.safeParse(
        creature([
          {
            id: 'not-a-uuid',
            equipmentId: ids.equipment,
            quantity: 2,
            useState: 'MAIN_HAND',
            attuned: false,
            actionFeatureIds: []
          },
          {
            id: 'not-a-uuid',
            equipmentId: ids.equipment,
            quantity: 1,
            useState: 'CARRIED',
            attuned: false,
            actionFeatureIds: []
          }
        ])
      ).success
    ).toBe(false)
  })

  it('rejects duplicate and dangling action Feature bindings', () => {
    expect(
      creatureAuthoredDtoSchema.safeParse(
        creature([
          {
            id: ids.loadout,
            equipmentId: ids.equipment,
            quantity: 1,
            useState: 'WORN',
            attuned: false,
            actionFeatureIds: [ids.feature]
          },
          {
            id: '00000000-0000-4000-8000-000000000008',
            equipmentId: '00000000-0000-4000-8000-000000000009',
            quantity: 1,
            useState: 'MAIN_HAND',
            attuned: false,
            actionFeatureIds: [ids.feature]
          }
        ])
      ).success
    ).toBe(false)
  })

  it('accepts one item per hand beside carried and worn items', () => {
    const entry = (n: number, useState: string) => ({
      id: `00000000-0000-4000-8000-0000000001${n}0`,
      equipmentId: `00000000-0000-4000-8000-0000000002${n}0`,
      quantity: 1,
      useState,
      attuned: false,
      actionFeatureIds: []
    })
    const parsed = creatureAuthoredDtoSchema.safeParse(
      creature([
        entry(1, 'MAIN_HAND'),
        entry(2, 'OFF_HAND'),
        { ...entry(3, 'CARRIED'), quantity: 20 },
        entry(4, 'WORN')
      ])
    )
    expect(parsed.error?.issues).toBeUndefined()
    expect(parsed.success).toBe(true)
  })

  it('refuses a second item in the same hand and the retired HELD state', () => {
    const entry = (n: number, useState: string) => ({
      id: `00000000-0000-4000-8000-0000000001${n}0`,
      equipmentId: `00000000-0000-4000-8000-0000000002${n}0`,
      quantity: 1,
      useState,
      attuned: false,
      actionFeatureIds: []
    })
    for (const hand of ['MAIN_HAND', 'OFF_HAND']) {
      const parsed = creatureAuthoredDtoSchema.safeParse(
        creature([entry(1, hand), entry(2, 'CARRIED'), entry(3, hand)])
      )
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toEqual([
        expect.objectContaining({ path: ['equipmentLoadout', 2, 'useState'] })
      ])
    }
    expect(creatureAuthoredDtoSchema.safeParse(creature([entry(1, 'HELD')])).success).toBe(false)
  })

  it('rejects bindings to Features without an ACTION invocation', () => {
    expect(
      creatureAuthoredDtoSchema.safeParse(
        creature(
          [
            {
              id: ids.loadout,
              equipmentId: ids.equipment,
              quantity: 1,
              useState: 'MAIN_HAND',
              attuned: false,
              actionFeatureIds: [ids.feature]
            }
          ],
          [
            {
              id: ids.feature,
              label: 'Passive Feature',
              description: 'Passive.',
              order: 1
            }
          ]
        )
      ).success
    ).toBe(false)
  })
})
