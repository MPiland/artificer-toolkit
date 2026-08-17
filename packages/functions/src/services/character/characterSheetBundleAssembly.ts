import {
  createCharacterBuilderDraftRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  type CharacterRow,
  type DBLike
} from '@artificer-toolkit/db'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { loadCharacterBuilderContext, resolveCharacterBuilder } from './builderService.js'
import { mergeCampaignSheetAdjustments } from './campaignCharacterSheet.js'
import { buildCharacterSheetBundle } from './sheetProjection.js'

export interface CharacterSheetRuleContext {
  adjustments: readonly CharacterSheetAdjustment[]
  additionalConditions: ReadonlyArray<{
    conditionTypeId: string
    notes?: string
  }>
  attunementSlotOverride: number | null
}

export async function assembleCharacterSheetBundleForRuleContext(params: {
  db: DBLike
  character: CharacterAuthored
  row: CharacterRow
  revisionId: string
  ruleContext: CharacterSheetRuleContext
}) {
  const adjustmentRepository = createCharacterSheetAdjustmentRepository(params.db)
  const playStateRepository = createCharacterSheetPlayStateRepository(params.db)
  const [
    context,
    adjustments,
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations,
    draft
  ] = await Promise.all([
    loadCharacterBuilderContext(params.db, params.character, [], {
      includeEffects: true
    }),
    adjustmentRepository.listByCharacter(params.character.id),
    adjustmentRepository.getMovementPreference(params.character.id),
    playStateRepository.listResourceUsage(params.character.id),
    playStateRepository.listSpellCustomizations(params.character.id),
    createCharacterBuilderDraftRepository(params.db).findByCharacter({
      characterId: params.character.id,
      userId: params.character.userId
    })
  ])
  const resolution = await resolveCharacterBuilder(
    params.db,
    params.character,
    'edit',
    context,
    null,
    params.revisionId
  )
  const bundle = await buildCharacterSheetBundle({
    db: params.db,
    character: params.character,
    resolution,
    streamVersion: params.row.stream_version,
    hasBuilderDraft: Boolean(draft),
    adjustments: mergeCampaignSheetAdjustments(adjustments, params.ruleContext.adjustments),
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations,
    additionalConditions: params.ruleContext.additionalConditions,
    ruleEvaluation: {
      context,
      revisionId: params.revisionId,
      attunementSlotOverride: params.ruleContext.attunementSlotOverride
    }
  })

  return { bundle, resolution }
}
