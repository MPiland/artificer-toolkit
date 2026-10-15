import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { InitiativeDeclarationAdjudicationFieldDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { EncounterD20RollModeDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { concentrationPromptText, deathSavePromptText } from '../ruleCheckCopy'

export type InitiativeDeclarationAdjudicationValues = Partial<
  Record<InitiativeDeclarationAdjudicationFieldDto['key'], string | string[] | number | null>
>

export function adjudicationSelectionValues(
  fields: readonly InitiativeDeclarationAdjudicationFieldDto[],
  values: InitiativeDeclarationAdjudicationValues
): Record<string, string | string[] | number | null> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      values[field.key] ?? (field.kind === 'MULTI_SELECT' ? [] : null)
    ])
  )
}

export const rollModeLabels = {
  NORMAL: 'Normal',
  ADVANTAGE: 'Advantage',
  DISADVANTAGE: 'Disadvantage'
} as const satisfies Record<EncounterD20RollModeDto, string>

/**
 * The face a d20 row keeps, matching the server's selection: the higher on advantage, the lower on
 * disadvantage (the first on a tie), otherwise the only face.
 */
export function keptFaceIndex(
  rollMode: EncounterD20RollModeDto,
  faces: readonly (number | string)[]
): number | null {
  if (rollMode === 'NORMAL') return 0
  const [first, second] = faces
  if (typeof first !== 'number' || typeof second !== 'number') return null
  return (rollMode === 'ADVANTAGE' ? second > first : second < first) ? 1 : 0
}

export function decisionTitle(kind: PendingEncounterRuleOccurrenceSummaryDto['kind']): string {
  if (kind === 'D20_EVIDENCE') return 'Roll required'
  if (kind === 'MOVEMENT_REACTION') return 'Reaction available'
  if (kind === 'MOVEMENT_PASSAGE_CHOICE') return 'Passage choice'
  if (kind === 'LEGENDARY_RESISTANCE_CHOICE') return 'Legendary Resistance'
  if (kind === 'REACTION_CHOICE') return 'Reaction available'
  if (kind === 'LEGENDARY_ACTION_CHOICE') return 'Legendary Action'
  if (kind === 'INITIATIVE_EVIDENCE') return 'Initiative roll required'
  if (kind === 'INITIATIVE_DECLARATION') return 'Initiative declaration required'
  if (kind === 'RECHARGE_EVIDENCE') return 'Recharge roll required'
  if (kind === 'ACTION_OUTCOME_EVIDENCE') return 'Action outcome required'
  if (kind === 'AREA_SAVES') return 'Area saves'
  return 'Initiative order required'
}

/** Names who a prompted roll is for and, when a rule raised it, why. */
export function rollPromptText(
  actorLabel: string,
  trigger: EncounterRuleRollTriggerDto | undefined
) {
  if (trigger?.kind === 'CONCENTRATION') return concentrationPromptText(actorLabel, trigger)
  if (trigger?.kind === 'DEATH_SAVE') return deathSavePromptText(actorLabel, trigger)
  if (trigger?.kind === 'BASIC_ACTION_CHECK')
    return `${trigger.actionLabel}: ${trigger.checkLabel} DC ${trigger.dc}`
  return `Roll for ${actorLabel}`
}
