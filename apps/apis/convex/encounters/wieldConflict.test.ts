import { describe, expect, it } from 'vitest'
import { evaluateEncounterWieldConflict } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'

const shieldId = 'shield-instance'
const armorClassFacts = {
  dexterityAbilityId: 'DEXTERITY',
  dexterityAbilityIndex: 1,
  equipment: [
    {
      itemInstanceId: 'armor-instance',
      source: {
        kind: 'EQUIPMENT_INSTANCE' as const,
        equipmentId: 'chain-mail',
        itemInstanceId: 'armor-instance'
      },
      category: 'ARMOR' as const,
      equippedSlot: 'ARMOR',
      armorClass: 16
    },
    {
      itemInstanceId: shieldId,
      source: {
        kind: 'EQUIPMENT_INSTANCE' as const,
        equipmentId: 'shield',
        itemInstanceId: shieldId
      },
      category: 'SHIELD' as const,
      equippedSlot: 'SHIELD',
      armorClass: 3
    }
  ]
}
const active = ['armor-instance', shieldId]

describe('encounter wield conflict', () => {
  it('requires stowing an active shield for a two-handed weapon, with its compiled AC', () => {
    expect(
      evaluateEncounterWieldConflict({
        armorClassFacts,
        activeEquipmentInstanceIds: active,
        weaponProperties: ['HEAVY', 'MARTIAL', 'MELEE', 'TWO_HANDED'],
        grip: 'ONE_HANDED'
      })
    ).toEqual({ kind: 'STOW_SHIELD', shieldItemInstanceId: shieldId, armorClassDelta: -3 })
  })

  it('uses the D&D armor class fallback when the shield has no authored AC', () => {
    expect(
      evaluateEncounterWieldConflict({
        armorClassFacts: {
          ...armorClassFacts,
          equipment: armorClassFacts.equipment.map((item) =>
            item.category === 'SHIELD' ? { ...item, armorClass: null } : item
          )
        },
        activeEquipmentInstanceIds: active,
        weaponProperties: ['RANGED', 'TWO_HANDED'],
        grip: 'ONE_HANDED'
      })
    ).toEqual({ kind: 'STOW_SHIELD', shieldItemInstanceId: shieldId, armorClassDelta: -2 })
  })

  it('conflicts for a versatile weapon only when gripped with two hands', () => {
    const input = {
      armorClassFacts,
      activeEquipmentInstanceIds: active,
      weaponProperties: ['MARTIAL', 'MELEE', 'VERSATILE']
    }
    expect(evaluateEncounterWieldConflict({ ...input, grip: 'ONE_HANDED' })).toEqual({
      kind: 'NONE'
    })
    expect(evaluateEncounterWieldConflict({ ...input, grip: 'TWO_HANDED' })).toEqual({
      kind: 'STOW_SHIELD',
      shieldItemInstanceId: shieldId,
      armorClassDelta: -3
    })
  })

  it('does not conflict for one-handed weapons, even with a two-handed grip', () => {
    for (const weaponProperties of [
      ['LIGHT', 'MELEE'],
      ['FINESSE', 'LIGHT', 'MELEE', 'THROWN']
    ])
      expect(
        evaluateEncounterWieldConflict({
          armorClassFacts,
          activeEquipmentInstanceIds: active,
          weaponProperties,
          grip: 'TWO_HANDED'
        })
      ).toEqual({ kind: 'NONE' })
  })

  it('ignores shields that are not active or not equipped', () => {
    const twoHanded = { weaponProperties: ['MELEE', 'TWO_HANDED'], grip: 'ONE_HANDED' as const }
    expect(
      evaluateEncounterWieldConflict({
        armorClassFacts,
        activeEquipmentInstanceIds: ['armor-instance'],
        ...twoHanded
      })
    ).toEqual({ kind: 'NONE' })
    expect(
      evaluateEncounterWieldConflict({
        armorClassFacts: undefined,
        activeEquipmentInstanceIds: active,
        ...twoHanded
      })
    ).toEqual({ kind: 'NONE' })
  })
})
