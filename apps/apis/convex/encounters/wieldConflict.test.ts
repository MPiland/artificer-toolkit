import { describe, expect, it } from 'vitest'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import { evaluateEncounterCharacterActionWieldConflict } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'

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

function evaluate(input: {
  grip: 'ONE_HANDED' | 'TWO_HANDED' | null
  armorClassFacts?: CharacterRulePolicyInput['armorClassFacts']
  activeEquipmentInstanceIds?: string[]
}) {
  return evaluateEncounterCharacterActionWieldConflict({
    candidate: {
      equipment: {
        itemInstanceId: 'weapon-instance',
        equipped: false,
        attuned: false,
        requiresAttunement: false,
        requiresEquipped: false,
        requiresAttuned: false,
        grip: input.grip
      }
    },
    ruleFacts: {
      armorClassFacts: 'armorClassFacts' in input ? input.armorClassFacts : armorClassFacts
    },
    policyOutput: {
      grantFold: { activeEquipmentInstanceIds: input.activeEquipmentInstanceIds ?? active }
    }
  })
}

describe('encounter wield conflict', () => {
  it('requires stowing an active shield for a two-handed grip, with its compiled AC', () => {
    expect(evaluate({ grip: 'TWO_HANDED' })).toEqual({
      kind: 'STOW_SHIELD',
      shieldItemInstanceId: shieldId,
      armorClassDelta: -3
    })
  })

  it('uses the D&D armor class fallback when the shield has no authored AC', () => {
    expect(
      evaluate({
        grip: 'TWO_HANDED',
        armorClassFacts: {
          ...armorClassFacts,
          equipment: armorClassFacts.equipment.map((item) =>
            item.category === 'SHIELD' ? { ...item, armorClass: null } : item
          )
        }
      })
    ).toEqual({ kind: 'STOW_SHIELD', shieldItemInstanceId: shieldId, armorClassDelta: -2 })
  })

  it('does not conflict for one-handed or grip-less actions', () => {
    expect(evaluate({ grip: 'ONE_HANDED' })).toEqual({ kind: 'NONE' })
    expect(evaluate({ grip: null })).toEqual({ kind: 'NONE' })
  })

  it('ignores shields that are not active or not equipped', () => {
    expect(
      evaluate({ grip: 'TWO_HANDED', activeEquipmentInstanceIds: ['armor-instance'] })
    ).toEqual({ kind: 'NONE' })
    expect(evaluate({ grip: 'TWO_HANDED', armorClassFacts: undefined })).toEqual({ kind: 'NONE' })
  })
})
