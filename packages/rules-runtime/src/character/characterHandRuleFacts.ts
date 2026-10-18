import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import {
  EQUIPMENT_PROPERTY_CODE,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

export function buildCharacterHandRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'handFacts'> {
  return {
    handFacts: {
      items: snapshot.equipmentItems.flatMap((item) =>
        item.equippedState
          ? [
              {
                itemInstanceId: item.instanceId,
                slot: item.equippedState.slot,
                twoHanded:
                  item.compiledItem.properties?.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED) ??
                  false
              }
            ]
          : []
      )
    }
  }
}
