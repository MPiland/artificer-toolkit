import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import { resolveAbilityAlias } from '@artificer-toolkit/shared/character'

import { abilityScoreCapabilityRegistry } from '../platformPolicyModules.js'

type ArmorClassFacts = NonNullable<CharacterRulePolicyInput['armorClassFacts']>

export function buildCharacterArmorClassRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'armorClassFacts'> {
  const { armorClass } = abilityScoreCapabilityRegistry.require(
    snapshot.systemId
  ).derivedStatisticAbilityCodes
  const dexterityAbilityIndex = Object.keys(snapshot.abilities).findIndex(
    (abilityId) => (resolveAbilityAlias(abilityId) ?? abilityId) === armorClass
  )
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
      dexterityAbilityIndex: dexterityAbilityIndex < 0 ? null : dexterityAbilityIndex,
      equipment
    }
  }
}
