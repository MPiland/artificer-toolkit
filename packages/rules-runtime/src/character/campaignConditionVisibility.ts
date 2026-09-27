import type { CharacterSheetCampaignContext } from './campaignCharacterSheet.js'

// Kept apart from the Sheet presentation module so Encounter projection reads do not load the
// Campaign text policy (and its word list) on every query execution.
export function getVisibleCampaignConditions(
  context: Pick<CharacterSheetCampaignContext, 'viewer' | 'conditions'>
): Array<{ conditionTypeId: string; notes?: string }> {
  return context.conditions
    .filter(
      (condition) => context.viewer === 'CAMPAIGN_OWNER' || condition.visibility === 'VISIBLE'
    )
    .map(({ conditionTypeId, notes }) => ({
      conditionTypeId,
      ...(notes ? { notes } : {})
    }))
}
