import { describe, expect, it } from 'vitest'

import {
  creatureAuthoredDtoSchema,
  creatureAuthoringInputDtoSchema,
  creaturePublicationDtoSchema
} from '../subjects/creature.js'

const uuid = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`

const attackRoll = (id: number) => ({
  id: uuid(id),
  label: 'Bite attack',
  kind: 'ATTACK',
  expression: { count: 1, die: 20, modifier: 4 },
  rollMode: 'NORMAL',
  chargeCost: null,
  order: 1
})

function feature(input: { triggerCode: string; rollDefinitions: unknown[]; asOption?: boolean }) {
  const source = {
    id: uuid(10),
    label: 'Bite',
    description: 'Bite. Melee Weapon Attack: +4 to hit.',
    order: 1,
    rollDefinitions: input.rollDefinitions,
    effects: [
      {
        id: uuid(11),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: input.triggerCode,
          activation: { code: 'ACTION', amount: 1 },
          range: { id: uuid(12), rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: uuid(13),
            order: 1,
            pathCode: 'ON_HIT',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: uuid(14),
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: uuid(15),
                  effectKind: 'DAMAGE',
                  damageTypeId: uuid(16),
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '2d4'
                }
              ]
            }
          }
        ]
      }
    ]
  }
  return input.asOption
    ? { id: uuid(20), label: 'Attacks', description: 'Attacks.', order: 1, options: [source] }
    : source
}

function creature(features: unknown[]) {
  return {
    id: uuid(1),
    label: 'Homebrew Wolf',
    userId: uuid(2),
    systemId: uuid(3),
    category: 'BEAST',
    creatureTypeId: uuid(4),
    size: 'MEDIUM',
    abilityScores: {
      STRENGTH: 12,
      DEXTERITY: 15,
      CONSTITUTION: 12,
      INTELLIGENCE: 3,
      WISDOM: 12,
      CHARISMA: 6
    },
    armorClass: 13,
    hitPoints: 11,
    speeds: [],
    features
  }
}

describe('Creature attack roll publication rule', () => {
  it('publishes an attack that defines exactly one ATTACK roll', () => {
    const parsed = creaturePublicationDtoSchema.safeParse(
      creature([feature({ triggerCode: 'MELEE_WEAPON_ATTACK', rollDefinitions: [attackRoll(30)] })])
    )
    expect(parsed.error?.issues).toBeUndefined()
  })

  it.each([
    ['no', [], 0, false],
    ['two', [attackRoll(30), { ...attackRoll(31), order: 2 }], 2, false],
    ['no option-level', [], 0, true]
  ])('refuses an attack with %s ATTACK roll definitions', (_, rollDefinitions, count, asOption) => {
    const parsed = creaturePublicationDtoSchema.safeParse(
      creature([feature({ triggerCode: 'MELEE_WEAPON_ATTACK', rollDefinitions, asOption })])
    )
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: asOption
          ? ['features', 0, 'options', 0, 'rollDefinitions']
          : ['features', 0, 'rollDefinitions'],
        message: `"Bite" makes an attack, so it must define exactly one ATTACK roll with its attack bonus (it defines ${count}).`
      })
    ])
  })

  it('needs no ATTACK roll for an action that is not an attack', () => {
    const parsed = creaturePublicationDtoSchema.safeParse(
      creature([feature({ triggerCode: 'ACTIVATED', rollDefinitions: [] })])
    )
    expect(parsed.error?.issues).toBeUndefined()
  })

  it('lets a draft be saved, and a published Creature be read, without the ATTACK roll', () => {
    const withoutRoll = creature([
      feature({ triggerCode: 'MELEE_WEAPON_ATTACK', rollDefinitions: [] })
    ])
    expect(creatureAuthoringInputDtoSchema.safeParse(withoutRoll).error?.issues).toBeUndefined()
    expect(creatureAuthoredDtoSchema.safeParse(withoutRoll).error?.issues).toBeUndefined()
  })
})
