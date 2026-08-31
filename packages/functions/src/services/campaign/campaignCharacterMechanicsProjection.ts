import {
  checksumCampaignCharacterMechanicsProjection,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignCharacterMechanicsProjectionSchema,
  type CampaignCharacterMechanicsProjection
} from '@artificer-toolkit/schema/projections/campaignCharacterMechanics'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  createCharacterCommittedSheetResolution,
  createCharacterCommittedSheetSpells,
  loadCharacterCommittedSheetSources
} from '../character/characterCommittedSheetSources.js'
import { evaluateCharacterRulePolicy } from '../character/characterRuleEvaluation.js'
import {
  checksumCampaignCharacterMechanicalContext,
  mergeCampaignSheetAdjustments
} from '../character/campaignCharacterSheet.js'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'

export const CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION = 3

export function compileCampaignCharacterMechanicsProjection(input: {
  baseMechanicsProjectionChecksum: string
  campaignId: string
  characterId: string
  characterStreamVersion: number
  manualMaximumModifierOwner: 'CHARACTER' | 'CAMPAIGN' | null
  mechanicalContextChecksum: string
  rulePolicyInput?: CharacterRulePolicyInput
  rulePolicyOutput?: CharacterRulePolicyOutput
}): CampaignCharacterMechanicsProjection {
  if ((input.rulePolicyInput == null) !== (input.rulePolicyOutput == null)) {
    throw new Error(
      'Campaign Character mechanics projections require both rule-policy documents or neither.'
    )
  }
  const materialized = input.rulePolicyInput != null && input.rulePolicyOutput != null
  const candidate = campaignCharacterMechanicsProjectionSchema.parse({
    ...input,
    manualMaximumModifierOwner: input.manualMaximumModifierOwner,
    kind: materialized ? 'MATERIALIZED' : 'BASE_REFERENCE',
    projectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
    projectionChecksum: '0'.repeat(64)
  })
  return {
    ...candidate,
    projectionChecksum: checksumCampaignCharacterMechanicsProjection(candidate)
  }
}

/**
 * Compiles the Campaign-owned result from the exact Character mechanics inputs.
 * Its caller owns the enclosing Campaign mutation transaction and publishes the
 * returned projection before that transaction commits.
 */
export async function prepareCampaignCharacterMechanicsProjection(input: {
  attunementSlotOverride: number | null
  campaignAdjustments: readonly CharacterSheetAdjustment[]
  campaignId: string
  character: CharacterAuthored
  characterStreamVersion: number
  db: DBLike
  mechanics: CharacterMechanicsProjection
}): Promise<CampaignCharacterMechanicsProjection> {
  const mechanicalContextChecksum = checksumCampaignCharacterMechanicalContext({
    adjustments: input.campaignAdjustments,
    attunementSlotOverride: input.attunementSlotOverride
  })
  if (input.campaignAdjustments.length === 0 && input.attunementSlotOverride === null) {
    return compileCampaignCharacterMechanicsProjection({
      campaignId: input.campaignId,
      characterId: input.character.id,
      characterStreamVersion: input.characterStreamVersion,
      baseMechanicsProjectionChecksum: input.mechanics.projectionChecksum,
      mechanicalContextChecksum,
      manualMaximumModifierOwner:
        input.mechanics.rulePolicyInput.hitPointFacts?.manualMaximumModifier == null
          ? null
          : 'CHARACTER'
    })
  }
  const [characterAdjustments, movementDisplayPreference, resourceUsage, sources] =
    await Promise.all([
      createCharacterSheetAdjustmentRepository(input.db).listByCharacter(input.character.id),
      createCharacterSheetAdjustmentRepository(input.db).getMovementPreference(input.character.id),
      createCharacterSheetPlayStateRepository(input.db).listResourceUsage(input.character.id),
      loadCharacterCommittedSheetSources({ db: input.db, mechanics: input.mechanics })
    ])
  const resolution = createCharacterCommittedSheetResolution({
    character: input.character,
    sources
  })
  const ruleEvaluation = await evaluateCharacterRulePolicy({
    db: input.db,
    character: input.character,
    context: {
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry,
      vocabularySnapshot: sources.vocabularySnapshot
    },
    adjustments: mergeCampaignSheetAdjustments(characterAdjustments, input.campaignAdjustments),
    movementDisplayPreference,
    resourceUsage,
    attunementSlotOverride: input.attunementSlotOverride,
    existingRevisionId: input.mechanics.ruleRevisionId,
    expectedRevisionId: input.mechanics.ruleRevisionId,
    pinnedSpellsById: createCharacterCommittedSheetSpells(sources)
  })
  return compileCampaignCharacterMechanicsProjection({
    campaignId: input.campaignId,
    characterId: input.character.id,
    characterStreamVersion: input.characterStreamVersion,
    baseMechanicsProjectionChecksum: input.mechanics.projectionChecksum,
    mechanicalContextChecksum,
    manualMaximumModifierOwner:
      ruleEvaluation.facts.hitPointFacts?.manualMaximumModifier == null
        ? null
        : input.campaignAdjustments.some(
              (adjustment) =>
                adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
            )
          ? 'CAMPAIGN'
          : 'CHARACTER',
    rulePolicyInput: ruleEvaluation.facts,
    rulePolicyOutput: ruleEvaluation.output
  })
}
