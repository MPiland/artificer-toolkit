import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import { abilityScoreCapabilityRegistry } from '../platformPolicyModules.js'
import { abilityRecordIndex } from './characterDerivedRuleFacts.js'

type ArmorClassFacts = NonNullable<CharacterRulePolicyInput['armorClassFacts']>

export function buildCharacterArmorClassRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'armorClassFacts'> {
  const { armorClass } = abilityScoreCapabilityRegistry.require(
    snapshot.systemId
  ).derivedStatisticAbilityCodes
  const dexterityAbilityIndex = abilityRecordIndex(snapshot.abilities, armorClass)
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
        armorClass: item.compiledItem.armorClass ?? null,
        ...(item.degradation === undefined ? {} : { degradation: item.degradation })
      }
    ]
  })

  return {
    armorClassFacts: {
      dexterityAbilityIndex,
      equipment
    }
  }
}
