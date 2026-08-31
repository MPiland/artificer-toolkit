import {
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterBuilderDraftRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  type CharacterRow,
  type DBLike
} from '@artificer-toolkit/db'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  createCharacterCommittedSheetExtras,
  createCharacterCommittedSheetResolution,
  createCharacterCommittedSheetSpells,
  loadCharacterCommittedSheetSources
} from './characterCommittedSheetSources.js'
import { createCommittedCharacterRuleEvaluation } from './characterCommittedRuleEvaluation.js'
import {
  checksumCampaignCharacterMechanicalContext,
  mergeCampaignSheetAdjustments
} from './campaignCharacterSheet.js'
import { CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION } from '../campaign/campaignCharacterMechanicsProjection.js'
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
  campaignId: string | null
  row: CharacterRow
  revisionId: string
  ruleContext: CharacterSheetRuleContext
  excludeCharacterAdjustmentIds?: readonly string[]
}) {
  const adjustmentRepository = createCharacterSheetAdjustmentRepository(params.db)
  const playStateRepository = createCharacterSheetPlayStateRepository(params.db)
  const [adjustments, movementDisplayPreference, resourceUsage, spellCustomizations, draft] =
    await Promise.all([
      adjustmentRepository.listByCharacter(params.character.id),
      adjustmentRepository.getMovementPreference(params.character.id),
      playStateRepository.listResourceUsage(params.character.id),
      playStateRepository.listSpellCustomizations(params.character.id),
      createCharacterBuilderDraftRepository(params.db).findByCharacter({
        characterId: params.character.id,
        userId: params.character.userId
      })
    ])
  const excludedCharacterAdjustmentIds = new Set(params.excludeCharacterAdjustmentIds)
  const effectiveCharacterAdjustments = adjustments.filter(
    (adjustment) => !excludedCharacterAdjustmentIds.has(adjustment.id)
  )
  const mergedAdjustments = mergeCampaignSheetAdjustments(
    effectiveCharacterAdjustments,
    params.ruleContext.adjustments
  )
  const mechanics = await createCharacterMechanicsProjectionRepository(params.db).requireCurrent({
    characterId: params.character.id,
    expectedRuleRevisionId: params.revisionId,
    expectedStreamVersion: params.row.stream_version
  })
  const campaignMechanics = params.campaignId
    ? await createCampaignCharacterMechanicsProjectionRepository(params.db).requireCurrent({
        campaignId: params.campaignId,
        characterId: params.character.id,
        expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
        expectedCharacterStreamVersion: params.row.stream_version,
        expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
          adjustments: params.ruleContext.adjustments,
          attunementSlotOverride: params.ruleContext.attunementSlotOverride
        }),
        expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
        baseMechanicsProjection: mechanics
      })
    : null
  const committedSources = await loadCharacterCommittedSheetSources({ db: params.db, mechanics })
  const resolution = createCharacterCommittedSheetResolution({
    character: params.character,
    sources: committedSources
  })
  const committedExtras = createCharacterCommittedSheetExtras({
    character: params.character,
    sources: committedSources
  })
  const pinnedSpellsById = createCharacterCommittedSheetSpells(committedSources)
  const context = {
    catalog: resolution.catalog,
    registry: resolution.sourceRegistry,
    vocabularySnapshot: committedSources.vocabularySnapshot
  }
  const committedRuleEvaluation = params.excludeCharacterAdjustmentIds?.length
    ? undefined
    : createCommittedCharacterRuleEvaluation({
        character: params.character,
        context,
        mechanics,
        adjustments: mergedAdjustments,
        movementDisplayPreference,
        ...(campaignMechanics
          ? {
              rulePolicy: {
                input: campaignMechanics.rulePolicyInput,
                output: campaignMechanics.rulePolicyOutput
              }
            }
          : {})
      })
  const bundle = await buildCharacterSheetBundle({
    db: params.db,
    character: params.character,
    resolution,
    streamVersion: params.row.stream_version,
    hasBuilderDraft: Boolean(draft),
    adjustments: mergedAdjustments,
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations,
    additionalConditions: params.ruleContext.additionalConditions,
    committedExtras,
    pinnedSpellsById,
    ruleEvaluation: {
      context,
      revisionId: params.revisionId,
      attunementSlotOverride: params.ruleContext.attunementSlotOverride
    },
    committedRuleEvaluation
  })

  return {
    bundle,
    mechanics,
    campaignMechanics,
    resolution,
    characterAdjustments: adjustments,
    movementDisplayPreference
  }
}
