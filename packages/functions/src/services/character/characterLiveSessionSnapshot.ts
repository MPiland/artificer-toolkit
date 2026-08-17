import { createCharacterRepository, type DBLike } from '@artificer-toolkit/db'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'

import type { CharacterSheetCommittedRuleSnapshot } from './sheetService.js'
import { assembleCharacterSheetBundleForRuleContext } from './characterSheetBundleAssembly.js'
import { resolveCharacterLiveSessionRuleContext } from './campaignCharacterSheet.js'

export async function loadCharacterRuleSnapshotForLiveSessionCampaign(
  db: DBLike,
  characterId: string,
  campaign: { id: string; attunementSlotOverride: number | null }
): Promise<CharacterSheetCommittedRuleSnapshot | null> {
  const repository = createCharacterRepository(db)
  const [row, character, ruleContext] = await Promise.all([
    repository.findById(characterId),
    repository.findAuthoredById(characterId),
    resolveCharacterLiveSessionRuleContext(db, characterId, campaign)
  ])
  if (
    !row ||
    !character ||
    !ruleContext ||
    (character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE
  ) {
    return null
  }
  if (!row.rule_pack_revision_id) {
    const error = new Error(
      `Active Character "${character.id}" does not have a pinned rule revision.`
    )
    error.name = 'CharacterRuleBindingError'
    throw error
  }
  const { bundle, resolution } = await assembleCharacterSheetBundleForRuleContext({
    db,
    character,
    row,
    revisionId: row.rule_pack_revision_id,
    ruleContext
  })

  return {
    streamVersion: row.stream_version,
    evaluation: bundle.ruleEvaluation,
    resolution
  }
}
