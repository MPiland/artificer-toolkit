import {
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  type DBLike
} from '@artificer-toolkit/db'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'

import type { CharacterSheetCommittedRuleSnapshot } from './sheetService.js'
import { assembleCharacterSheetBundleForRuleContext } from './characterSheetBundleAssembly.js'
import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext
} from './campaignCharacterSheet.js'
import { CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION } from '../campaign/campaignCharacterMechanicsProjection.js'

function toFeet(range: { amount: number; unit: string }): number | null {
  switch (range.unit) {
    case 'FEET':
      return range.amount
    case 'INCHES':
      return range.amount / 12
    case 'MILES':
      return range.amount * 5_280
    case 'YARDS':
      return range.amount * 3
    default:
      return null
  }
}

export function resolveCharacterSceneVisionDimRangeFeet(
  senses: CharacterRulePolicyOutput['senses'],
  adjustments: readonly CharacterSheetAdjustment[] = []
): number | null {
  const baseRange = senses.reduce<number | null>((maximum, sense) => {
    if (sense.senseCode.toUpperCase() !== 'DARKVISION' || !sense.range) return maximum
    const feet = toFeet(sense.range)
    if (feet === null) return maximum
    return maximum === null ? feet : Math.max(maximum, feet)
  }, null)
  const override = adjustments.find(
    (adjustment) =>
      adjustment.family === 'SENSE' &&
      adjustment.field === 'RANGE_OVERRIDE' &&
      adjustment.senseId.toUpperCase() === 'DARKVISION'
  )
  if (!override || typeof override.value !== 'number') return baseRange
  const baseDarkvisionRange = senses.find(
    (sense) => sense.senseCode.toUpperCase() === 'DARKVISION'
  )?.range
  return toFeet({ amount: override.value, unit: baseDarkvisionRange?.unit ?? 'FEET' })
}

export async function loadCharacterSceneVisionForLiveSessionCampaign(
  db: DBLike,
  characterId: string,
  campaign: { id: string; attunementSlotOverride: number | null }
) {
  const repository = createCharacterRepository(db)
  const [row, ruleContext] = await Promise.all([
    repository.findById(characterId),
    resolveCharacterLiveSessionRuleContext(db, characterId, campaign)
  ])
  if (!row || !ruleContext || row.status !== AUTHORED_RECORD_STATUS.ACTIVE) return null
  if (!row.rule_pack_revision_id) {
    const error = new Error(
      `Active Character "${characterId}" does not have a pinned rule revision.`
    )
    error.name = 'CharacterRuleBindingError'
    throw error
  }
  const mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
    characterId,
    expectedStreamVersion: row.stream_version,
    expectedRuleRevisionId: row.rule_pack_revision_id
  })
  const campaignMechanics = await createCampaignCharacterMechanicsProjectionRepository(db).requireCurrent({
    campaignId: campaign.id,
    characterId,
    expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
    expectedCharacterStreamVersion: row.stream_version,
    expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
      adjustments: ruleContext.adjustments,
      attunementSlotOverride: ruleContext.attunementSlotOverride
    }),
    expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
    baseMechanicsProjection: mechanics
  })
  const dimRangeFeet = resolveCharacterSceneVisionDimRangeFeet(campaignMechanics.rulePolicyOutput.senses)
  return { streamVersion: row.stream_version, dimRangeFeet }
}

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
  const { bundle, campaignMechanics, mechanics, resolution } = await assembleCharacterSheetBundleForRuleContext({
    db,
    character,
    campaignId: campaign.id,
    row,
    revisionId: row.rule_pack_revision_id,
    ruleContext
  })

  return {
    mechanicsProjectionChecksum: mechanics.projectionChecksum,
    mechanicsCommandLaneChecksum: mechanics.commandLaneChecksum,
    mechanicsPayload: {
      ruleSnapshot: mechanics.ruleSnapshot,
      rulePolicyInput: mechanics.rulePolicyInput,
      rulePolicyOutput: mechanics.rulePolicyOutput,
      ruleRegistry: mechanics.ruleRegistry
    },
    campaignMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
      adjustments: ruleContext.adjustments,
      attunementSlotOverride: ruleContext.attunementSlotOverride
    }),
    campaignMechanicsProjectionChecksum: campaignMechanics?.projectionChecksum ?? null,
    streamVersion: row.stream_version,
    evaluation: bundle.ruleEvaluation,
    resolution
  }
}
