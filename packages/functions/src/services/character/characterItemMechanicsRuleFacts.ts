import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

type ItemMechanicsFacts = CharacterRulePolicyInput['itemMechanicsFacts']

export function buildCharacterItemMechanicsRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'itemMechanicsFacts'> {
  const adjustments: ItemMechanicsFacts['adjustments'] = []
  for (const adjustment of snapshot.adjustments ?? []) {
    if (adjustment.family === 'ITEM' && typeof adjustment.value === 'number') {
      adjustments.push({
        id: adjustment.id,
        itemInstanceId: adjustment.itemInstanceId,
        field: adjustment.field,
        value: adjustment.value
      })
    }
    if (adjustment.family === 'ITEM' && adjustment.value === true) {
      adjustments.push({
        id: adjustment.id,
        itemInstanceId: adjustment.itemInstanceId,
        field: adjustment.field,
        value: adjustment.value
      })
    }
  }

  return {
    itemMechanicsFacts: {
      items: snapshot.equipmentItems.map((item) => ({
        itemInstanceId: item.instanceId,
        costAmount: item.compiledItem.cost?.amount ?? null,
        weight: item.compiledItem.weight
          ? { amount: item.compiledItem.weight.amount, unit: item.compiledItem.weight.unit }
          : null
      })),
      adjustments
    }
  }
}
