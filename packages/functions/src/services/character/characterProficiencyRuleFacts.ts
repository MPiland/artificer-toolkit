import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

type ProficiencyFacts = CharacterRulePolicyInput['proficiencyFacts']

export function buildCharacterProficiencyRuleFacts(
  snapshot: CharacterBuildSnapshot
): Pick<CharacterRulePolicyInput, 'proficiencyFacts'> {
  const manualAdditions: ProficiencyFacts['manualAdditions'] = (snapshot.adjustments ?? []).flatMap(
    (adjustment) =>
      adjustment.family === 'PROFICIENCY' &&
      (adjustment.proficiencyKind === 'ARMOR' ||
        adjustment.proficiencyKind === 'LANGUAGE' ||
        adjustment.proficiencyKind === 'TOOL' ||
        adjustment.proficiencyKind === 'WEAPON')
        ? [
            {
              sourceId: adjustment.id,
              source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: adjustment.id },
              proficiencyKind: adjustment.proficiencyKind,
              targetId: adjustment.targetId
            }
          ]
        : []
  )

  return { proficiencyFacts: { manualAdditions } }
}
