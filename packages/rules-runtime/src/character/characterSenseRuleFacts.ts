import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

type SenseFacts = NonNullable<CharacterRulePolicyInput['senseFacts']>

export function buildCharacterSenseRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'senseFacts'> {
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'SENSE'
  )
  return {
    senseFacts: {
      overrides: adjustments.map((adjustment) => ({
        senseDefinitionId: adjustment.senseId,
        sourceId: adjustment.id,
        value: adjustment.value,
        // The Sheet's RANGE_OVERRIDE contract records its value in feet.
        unit: 'FEET'
      })) as SenseFacts['overrides']
    }
  }
}
