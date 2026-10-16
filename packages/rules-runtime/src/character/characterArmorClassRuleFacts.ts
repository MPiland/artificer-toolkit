import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import { resolveAbilityAlias } from '@artificer-toolkit/shared/character'

type ArmorClassFacts = NonNullable<CharacterRulePolicyInput['armorClassFacts']>

function isDexterity(abilityId: string): boolean {
  return (resolveAbilityAlias(abilityId) ?? abilityId) === 'DEXTERITY'
}

export function buildCharacterArmorClassRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'armorClassFacts'> {
  const abilityIds = Object.keys(snapshot.abilities)
  const dexterityAbilityIndex = abilityIds.findIndex(isDexterity)
  const equipment: ArmorClassFacts['equipment'] = snapshot.equipmentItems.flatMap((item) => {
    if (!item.equippedState) return []
    if (item.compiledItem.category !== 'ARMOR' && item.compiledItem.category !== 'SHIELD') return []

    return [
      {
        itemInstanceId: item.instanceId,
        source: {
          kind: 'EQUIPMENT_INSTANCE' as const,
          equipmentId: item.contentRef.definitionId,
          itemInstanceId: item.instanceId
        },
        category: item.compiledItem.category,
        equippedSlot: item.equippedState.slot,
        armorClass: item.compiledItem.armorClass ?? null
      }
    ]
  })

  return {
    armorClassFacts: {
      dexterityAbilityIndex: dexterityAbilityIndex < 0 ? null : dexterityAbilityIndex,
      equipment
    }
  }
}
