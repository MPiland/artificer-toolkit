import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

type DefenseFacts = CharacterRulePolicyInput['defenseFacts']

export function buildCharacterDefenseRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'defenseFacts'> {
  const manualAdditions: DefenseFacts['manualAdditions'] = (snapshot.adjustments ?? []).flatMap(
    (adjustment) =>
      adjustment.family === 'DEFENSE'
        ? [
            {
              sourceId: adjustment.id,
              source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: adjustment.id },
              kind: adjustment.defenseKind,
              damageTypeId: adjustment.damageTypeId
            }
          ]
        : []
  )

  return { defenseFacts: { manualAdditions } }
}
