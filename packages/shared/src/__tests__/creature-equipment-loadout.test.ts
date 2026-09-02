import { describe, expect, it } from 'vitest'

import { compileCreature } from '../domains/subjects/compilers/creature.js'
import type { CreatureAuthored } from '../domains/subjects/authored/creature.js'

function creature(): CreatureAuthored {
  return {
    id: 'creature-loadout',
    label: 'Loadout Creature',
    userId: 'user',
    systemId: 'system',
    category: 'MONSTER',
    creatureTypeId: 'humanoid',
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
    features: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        label: 'Sword',
        description: 'Attack.',
        order: 1,
        effects: [
          {
            id: 'sword-effect',
            order: 1,
            invocation: {
              kind: 'ACTION',
              triggerCode: 'ACTIVATED',
              activation: { code: 'ACTION', amount: 1 },
              range: { id: 'self', rangeKind: 'SELF' }
            },
            paths: []
          }
        ]
      }
    ],
    equipmentLoadout: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        equipmentId: '00000000-0000-4000-8000-000000000002',
        quantity: 1,
        useState: 'HELD',
        attuned: false,
        actionFeatureIds: ['00000000-0000-4000-8000-000000000003']
      }
    ]
  }
}

describe('Creature equipment loadout compiler', () => {
  it('preserves valid authored loadout identity and bindings', () => {
    expect(compileCreature(creature()).equipmentLoadout).toEqual(creature().equipmentLoadout)
  })

  it('accepts an equipment binding whose action is authored only through Feature options', () => {
    const optionOnly = creature()
    const [feature] = optionOnly.features ?? []
    if (!feature) throw new Error('Missing Creature Feature fixture.')
    const effects = feature.effects ?? []
    feature.effects = []
    feature.options = [
      {
        id: '00000000-0000-4000-8000-000000000005',
        label: 'Sword option',
        description: '',
        order: 1,
        effects
      }
    ]

    expect(compileCreature(optionOnly).equipmentLoadout).toEqual(optionOnly.equipmentLoadout)
  })

  it('rejects an equipment binding to a missing Feature', () => {
    const invalid = creature()
    invalid.equipmentLoadout![0]!.actionFeatureIds = ['00000000-0000-4000-8000-000000000004']

    expect(() => compileCreature(invalid)).toThrow('references missing action Feature')
  })

  it.each([
    [
      'malformed entry identity',
      (entry: NonNullable<CreatureAuthored['equipmentLoadout']>[number]) => {
        entry.id = 'not-a-uuid'
      }
    ],
    [
      'zero carried quantity',
      (entry: NonNullable<CreatureAuthored['equipmentLoadout']>[number]) => {
        entry.useState = 'CARRIED'
        entry.quantity = 0
      }
    ],
    [
      'fractional carried quantity',
      (entry: NonNullable<CreatureAuthored['equipmentLoadout']>[number]) => {
        entry.useState = 'CARRIED'
        entry.quantity = 1.5
      }
    ]
  ])('rejects %s before compiling the Creature', (_name, mutate) => {
    const invalid = creature()
    mutate(invalid.equipmentLoadout![0]!)

    expect(() => compileCreature(invalid)).toThrow()
  })
})
