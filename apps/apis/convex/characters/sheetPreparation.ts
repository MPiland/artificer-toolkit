import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import { getCharacterSheetDisplayAdjustments } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import { projectCharacterSheetBundle } from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { requireCharacterPresentation } from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import { evaluateCharacterActiveGrantRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import type { QueryCtx } from '../_generated/server'
import { loadCharacterSheetFacts, type CharacterSheetSourceContext } from './sheetFacts'

/** Personal Sheet reads recompute current authorized sources; no stored projection is served. */
export async function loadCharacterSheet(
  ctx: QueryCtx,
  userId: string,
  lookupId: string,
  campaignId?: string,
  sourceContext?: CharacterSheetSourceContext,
  catalogScope: 'active' | 'resolution' = 'active',
  authorityScope?: import('../campaigns/authority').CampaignInternalScope,
  referenceSpellIds: readonly string[] = []
) {
  const facts = await loadCharacterSheetFacts(
    ctx,
    userId,
    lookupId,
    campaignId,
    sourceContext,
    catalogScope,
    authorityScope,
    undefined,
    referenceSpellIds
  )
  if (!facts) return null
  return projectCharacterSheetFacts(facts)
}

/** Projects facts already loaded in the current mutation; never retains them across transactions. */
export function projectCharacterSheetFacts(
  facts: NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts>>>
) {
  // Sheet views read prose by id (D163); commit's evaluation context carries none.
  const { presentation } = requireCharacterPresentation(facts.prepared.context)
  // The Sheet folds the Character's active grants exactly as the room does.
  const ruleEvaluation = evaluateCharacterActiveGrantRules({
    gameSystemId: facts.prepared.character.systemId,
    evaluation: facts.ruleEvaluation,
    activeEffects: facts.activeEffects,
    vocabularySnapshot: facts.prepared.context.vocabularySnapshot
  })
  const { sheet, ruleProjection } = projectCharacterSheetBundle({
    character: facts.prepared.character,
    resolution: facts.prepared.resolution,
    streamVersion: facts.active.play.streamVersion,
    hasBuilderDraft: facts.draft !== null,
    adjustments: facts.adjustments,
    additionalConditions: getVisibleCampaignConditions(facts.campaignContext),
    additionalCurrencyOptions: facts.campaignContext.currencyOptions,
    presentation,
    spellCustomizations: facts.sheetState.spellCustomizations,
    ruleEvaluation,
    activeEffects: facts.activeEffects,
    concentrationEffects: facts.concentrationEffects
  })
  return {
    active: facts.active,
    sourceContext: facts.sourceContext,
    // Read-time Builder reconciliation is projection input, never an unrelated Sheet write.
    character: facts.character,
    sheetState: facts.sheetState,
    campaignContext: facts.campaignContext,
    displayAdjustments: getCharacterSheetDisplayAdjustments(
      facts.sheetState.adjustments,
      facts.campaignContext
    ),
    evaluationInput: facts.evaluationInput,
    activeEffects: facts.activeEffects,
    ruleEvaluation,
    ruleProjection,
    resolution: facts.prepared.resolution,
    spellsById: facts.prepared.context.spellsById,
    presentation,
    contentMaturity: facts.prepared.context.sourceAccess.campaign?.contentMaturity ?? null,
    sheet: {
      ...sheet,
      meta: { ...sheet.meta, partyVisibility: facts.sheetState.partyVisibility },
      publicId: facts.route.publicId
    } satisfies CharacterSheetResponseDto
  }
}
