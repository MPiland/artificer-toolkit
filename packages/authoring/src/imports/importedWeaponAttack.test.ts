import { describe, expect, it } from 'vitest'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import {
  meleeReachWeaponEffects,
  meleeVersatileWeaponEffects,
  meleeWeaponEffects,
  rangedWeaponEffects,
  thrownVersatileWeaponEffects,
  thrownWeaponEffects,
  type EquipmentChildId
} from '@artificer-toolkit/shared/authored'

import type { ExternalCustomContent } from './importParsers.js'
import { applyImportedWeaponAttack } from './importedWeaponAttack.js'

const damageTypes = [
  { id: '00000000-0000-0000-0004-000100000000', code: 'ACID', label: 'Acid' },
  { id: '00000000-0000-0000-0004-000300000000', code: 'SLASHING', label: 'Slashing' }
]
const slashingId = damageTypes[1]!.id

function sequentialIds() {
  let next = 0
  return () => `00000000-0000-4000-8000-${(++next).toString().padStart(12, '0')}`
}

function weapon(
  weaponAttack: NonNullable<ExternalCustomContent['weaponAttack']>,
  properties: string[]
): ExternalCustomContent {
  return {
    subjectKind: 'EQUIPMENT',
    externalId: 'sword-1',
    label: 'Moon Blade',
    path: ['inventory', 0, 'definition'],
    payload: {
      kind: 'EQUIPMENT',
      label: 'Moon Blade',
      description: '',
      category: 'WEAPON',
      rarityId: '',
      properties
    },
    weaponAttack
  }
}

function parseEquipment(payload: Record<string, unknown>) {
  return equipmentAuthoredDtoSchema.parse({
    ...payload,
    id: '00000000-0000-4000-8000-0000000000a1',
    description: null,
    userId: 'user-1',
    systemId: 'system-1'
  })
}

describe('applyImportedWeaponAttack', () => {
  it('leaves content without a weapon attack untouched', () => {
    const custom = { ...weapon({ damageTypeName: 'x', dice: '1d4', grip: 'ONE_HANDED' }, []) }
    delete custom.weaponAttack
    expect(applyImportedWeaponAttack(custom, damageTypes, sequentialIds())).toEqual({
      payload: custom.payload,
      issues: []
    })
  })

  it('resolves the damage type name to the System vocabulary id, ignoring case', () => {
    const { payload, issues } = applyImportedWeaponAttack(
      weapon({ damageTypeName: 'slashing', dice: '1d8', grip: 'ONE_HANDED', meleeReachFeet: 5 }, [
        'MELEE'
      ]),
      damageTypes,
      sequentialIds()
    )
    expect(issues).toEqual([])
    const equipment = parseEquipment(payload)
    const [effect] = equipment.category === 'VARIANT' ? [] : (equipment.effects ?? [])
    expect(effect).toMatchObject({
      grip: 'ONE_HANDED',
      invocation: {
        triggerCode: 'MELEE_WEAPON_ATTACK',
        range: { rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }
      },
      paths: [
        {
          pathCode: 'ON_HIT',
          resultBlock: {
            outcomes: [
              {
                effectKind: 'DAMAGE',
                damageTypeId: damageTypes[1]!.id,
                valueKind: 'DICE',
                diceConfig: '1d8'
              }
            ]
          }
        }
      ]
    })
  })

  it('builds one effect per grip for a versatile weapon and a two-handed effect for a two-handed one', () => {
    const versatile = parseEquipment(
      applyImportedWeaponAttack(
        weapon(
          {
            damageTypeName: 'Slashing',
            dice: '1d8',
            versatileDice: '1d10',
            grip: 'ONE_HANDED',
            meleeReachFeet: 5
          },
          ['MELEE', 'VERSATILE']
        ),
        damageTypes,
        sequentialIds()
      ).payload
    )
    expect(
      versatile.category !== 'VARIANT' && versatile.effects?.map((effect) => effect.grip)
    ).toEqual(['ONE_HANDED', 'TWO_HANDED'])

    const twoHanded = parseEquipment(
      applyImportedWeaponAttack(
        weapon(
          { damageTypeName: 'Slashing', dice: '2d6', grip: 'TWO_HANDED', meleeReachFeet: 10 },
          ['MELEE', 'TWO_HANDED', 'REACH']
        ),
        damageTypes,
        sequentialIds()
      ).payload
    )
    expect(
      twoHanded.category !== 'VARIANT' &&
        twoHanded.effects?.map((effect) => [effect.grip, effect.invocation])
    ).toEqual([
      ['TWO_HANDED', expect.objectContaining({ range: expect.objectContaining({ amount: 10 }) })]
    ])
  })

  it('adds a ranged attack with its normal and long range', () => {
    const equipment = parseEquipment(
      applyImportedWeaponAttack(
        weapon(
          {
            damageTypeName: 'Slashing',
            dice: '1d4',
            grip: 'ONE_HANDED',
            meleeReachFeet: 5,
            ranged: { normalFeet: 20, longFeet: 60 }
          },
          ['MELEE', 'THROWN']
        ),
        damageTypes,
        sequentialIds()
      ).payload
    )
    expect(
      equipment.category !== 'VARIANT' &&
        equipment.effects?.map((effect) => effect.invocation.triggerCode)
    ).toEqual(['MELEE_WEAPON_ATTACK', 'RANGED_WEAPON_ATTACK'])
    expect(
      equipment.category !== 'VARIANT' && equipment.effects?.[1]?.invocation.range
    ).toMatchObject({ amount: 20, longAmount: 60 })
  })

  it.each([
    [
      'a melee weapon',
      { dice: '1d8', grip: 'ONE_HANDED', meleeReachFeet: 5 },
      (childId: EquipmentChildId) => meleeWeaponEffects(childId, slashingId, '1d8', 'ONE_HANDED')
    ],
    [
      'a reach weapon',
      { dice: '1d10', grip: 'TWO_HANDED', meleeReachFeet: 10 },
      (childId: EquipmentChildId) =>
        meleeReachWeaponEffects(childId, slashingId, '1d10', 'TWO_HANDED')
    ],
    [
      'a versatile weapon',
      { dice: '1d8', versatileDice: '1d10', grip: 'ONE_HANDED', meleeReachFeet: 5 },
      (childId: EquipmentChildId) => meleeVersatileWeaponEffects(childId, slashingId, '1d8', '1d10')
    ],
    [
      'a thrown weapon',
      {
        dice: '1d6',
        grip: 'ONE_HANDED',
        meleeReachFeet: 5,
        ranged: { normalFeet: 20, longFeet: 60 }
      },
      (childId: EquipmentChildId) =>
        thrownWeaponEffects(childId, slashingId, '1d6', 20, 60, 'ONE_HANDED')
    ],
    [
      'a versatile thrown weapon',
      {
        dice: '1d6',
        versatileDice: '1d8',
        grip: 'ONE_HANDED',
        meleeReachFeet: 5,
        ranged: { normalFeet: 20, longFeet: 60 }
      },
      (childId: EquipmentChildId) =>
        thrownVersatileWeaponEffects(childId, slashingId, '1d6', '1d8', 20, 60)
    ],
    [
      'a ranged weapon',
      { dice: '1d8', grip: 'TWO_HANDED', ranged: { normalFeet: 150, longFeet: 600 } },
      (childId: EquipmentChildId) =>
        rangedWeaponEffects(childId, slashingId, '1d8', 150, 600, 'TWO_HANDED')
    ]
  ] as const)(
    'builds the effects of the SRD weapon with the same shape for %s',
    (_name, attack, build) => {
      const { payload } = applyImportedWeaponAttack(
        weapon({ damageTypeName: 'Slashing', ...attack }, ['MELEE']),
        damageTypes,
        sequentialIds()
      )
      const ids = sequentialIds()
      expect(payload.effects).toEqual(build(() => ids()))
    }
  )

  it('imports the weapon without an attack and reports an unknown damage type', () => {
    const { payload, issues } = applyImportedWeaponAttack(
      weapon({ damageTypeName: 'Moonlight', dice: '1d8', grip: 'ONE_HANDED', meleeReachFeet: 5 }, [
        'MELEE'
      ]),
      damageTypes,
      sequentialIds()
    )
    expect(payload).not.toHaveProperty('effects')
    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'WARNING',
        code: 'UNKNOWN_DAMAGE_TYPE',
        path: ['inventory', 0, 'definition'],
        correctionRequired: true
      })
    ])
  })
})
