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
    naturalArmorBonus: 1,
    hitPoints: 11,
    speeds: [],
    details: [],
    proficiencies: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    qualifiedDamageDefenses: [],
    conditionImmunities: [],
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

  it('offers a versatile weapon as one effect per grip (D57 ruling 1)', () => {
    const bite = feature({ triggerCode: 'MELEE_WEAPON_ATTACK', rollDefinitions: [attackRoll(30)] })
    const [oneHanded] = 'effects' in bite ? bite.effects : []
    const withGrips = (grips: readonly ('ONE_HANDED' | 'TWO_HANDED' | undefined)[]) =>
      creature([
        {
          ...bite,
          effects: grips.map((grip, index) => ({
            ...oneHanded,
            id: uuid(40 + index),
            order: index + 1,
            ...(grip ? { grip } : {})
          }))
        }
      ])
    expect(
      creaturePublicationDtoSchema.safeParse(withGrips(['ONE_HANDED', 'TWO_HANDED'])).error?.issues
    ).toBeUndefined()
    for (const grips of [
      ['ONE_HANDED'],
      ['TWO_HANDED', 'TWO_HANDED'],
      ['ONE_HANDED', undefined]
    ] as const)
      expect(creatureAuthoredDtoSchema.safeParse(withGrips(grips)).error?.issues).toEqual([
        expect.objectContaining({
          path: ['features', 0, 'effects'],
          message:
            '"Bite" names grips, so it must author exactly one one-handed and one two-handed effect of that attack.'
        })
      ])
    const [activated] = (() => {
      const source = feature({ triggerCode: 'ACTIVATED', rollDefinitions: [] })
      return 'effects' in source ? source.effects : []
    })()
    expect(
      creatureAuthoredDtoSchema.safeParse(
        creature([
          {
            ...bite,
            effects: [
              { ...activated, grip: 'ONE_HANDED' },
              { ...activated, id: uuid(41), order: 2, grip: 'TWO_HANDED' }
            ]
          }
        ])
      ).error?.issues
    ).toEqual(
      [0, 1].map((index) =>
        expect.objectContaining({
          path: ['features', 0, 'effects', index, 'grip'],
          message: 'Only weapon attack effects have a grip.'
        })
      )
    )
  })

  it('refuses an attack with the wielded weapons, since a Creature wields no items (D156)', () => {
    const bite = feature({ triggerCode: 'MELEE_WEAPON_ATTACK', rollDefinitions: [attackRoll(30)] })
    const [attack] = 'effects' in bite ? bite.effects : []
    expect(
      creatureAuthoredDtoSchema.safeParse(
        creature([{ ...bite, effects: [{ ...attack, weaponAttack: {} }] }])
      ).error?.issues
    ).toEqual([
      expect.objectContaining({
        path: ['features', 0, 'effects', 0, 'weaponAttack'],
        message: '"Bite" belongs to a Creature, which wields no items to attack with.'
      })
    ])
  })

  it('lets a draft be saved, and a published Creature be read, without the ATTACK roll', () => {
    const withoutRoll = creature([
      feature({ triggerCode: 'MELEE_WEAPON_ATTACK', rollDefinitions: [] })
    ])
    expect(creatureAuthoringInputDtoSchema.safeParse(withoutRoll).error?.issues).toBeUndefined()
    expect(creatureAuthoredDtoSchema.safeParse(withoutRoll).error?.issues).toBeUndefined()
  })
})

describe('Creature Legendary options that run an action (D51 option B)', () => {
  const bite = feature({ triggerCode: 'MELEE_WEAPON_ATTACK', rollDefinitions: [attackRoll(30)] })
  const legendary = (actionReference: { featureId: string; chargeCost: number }, extra = {}) => ({
    id: uuid(50),
    label: 'Legendary Actions',
    description: 'Legendary Actions.',
    order: 2,
    charges: {
      id: uuid(51),
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'MANUAL',
      amount: 3
    },
    options: [
      {
        id: uuid(52),
        label: 'Bite Attack',
        description: 'The wolf makes a bite attack.',
        order: 1,
        actionReference,
        ...extra
      }
    ]
  })

  it('names another action Feature of the Creature, at a cost its pool can pay', () => {
    expect(
      creaturePublicationDtoSchema.safeParse(
        creature([bite, legendary({ featureId: uuid(10), chargeCost: 2 })])
      ).error?.issues
    ).toBeUndefined()
  })

  it.each([
    ['a missing Feature', { featureId: uuid(99), chargeCost: 1 }, 'featureId'],
    ['its own Feature', { featureId: uuid(50), chargeCost: 1 }, 'featureId'],
    ['more than its pool', { featureId: uuid(10), chargeCost: 4 }, 'chargeCost']
  ])('refuses %s', (_, reference, field) => {
    expect(
      creatureAuthoredDtoSchema.safeParse(creature([bite, legendary(reference)])).error?.issues
    ).toEqual([
      expect.objectContaining({
        path: ['features', 1, 'options', 0, 'actionReference', field]
      })
    ])
  })

  it('authors no effects of its own', () => {
    const effects = 'effects' in bite ? bite.effects : []
    expect(
      creatureAuthoredDtoSchema.safeParse(
        creature([bite, legendary({ featureId: uuid(10), chargeCost: 1 }, { effects })])
      ).error?.issues
    ).toEqual([
      expect.objectContaining({
        path: ['features', 1, 'options', 0, 'effects'],
        message: 'An option that runs another action authors no effects of its own.'
      })
    ])
  })
})
