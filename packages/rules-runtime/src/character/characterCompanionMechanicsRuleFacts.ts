import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'

type CompanionMechanicsFacts = CharacterRulePolicyInput['companionMechanicsFacts']

export function buildCharacterCompanionMechanicsRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'companionMechanicsFacts'> {
  const adjustments: CompanionMechanicsFacts['adjustments'] = []
  for (const adjustment of snapshot.adjustments ?? []) {
    if (adjustment.family !== 'COMPANION') {
      continue
    }
    if (adjustment.field === 'SIZE_OVERRIDE') {
      systemCoreCodeRegistry.requireCode(snapshot.systemId, 'size', adjustment.value)
      adjustments.push({
        id: adjustment.id,
        companionInstanceId: adjustment.companionInstanceId,
        field: adjustment.field,
        value: adjustment.value
      })
    } else if (
      adjustment.field === 'ALIGNMENT_OVERRIDE' ||
      adjustment.field === 'CREATURE_TYPE_OVERRIDE'
    ) {
      adjustments.push({
        id: adjustment.id,
        companionInstanceId: adjustment.companionInstanceId,
        field: adjustment.field,
        value: adjustment.value
      })
    } else if (typeof adjustment.value === 'number') {
      adjustments.push({
        id: adjustment.id,
        companionInstanceId: adjustment.companionInstanceId,
        field: adjustment.field,
        value: adjustment.value
      })
    }
  }

  return {
    companionMechanicsFacts: {
      companions: (snapshot.companions ?? []).map((companion) => ({
        companionInstanceId: companion.companionInstanceId,
        creatureId: companion.creatureId,
        abilityScores: { ...companion.abilityScores },
        armorClass: companion.armorClass,
        maxHitPoints: companion.maxHitPoints,
        size:
          companion.size === undefined
            ? null
            : systemCoreCodeRegistry.requireCode(snapshot.systemId, 'size', companion.size).code,
        alignmentId: companion.alignmentId ?? null,
        creatureTypeId: companion.creatureTypeId ?? null
      })),
      adjustments
    }
  }
}
