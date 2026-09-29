import { characterSheetResponseDtoSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { getCharacterSheetDisplayAdjustments } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { getVisibleCampaignConditions } from '@artificer-toolkit/rules-runtime/character/campaignConditionVisibility'
import { projectCharacterSheetBundle } from '@artificer-toolkit/rules-runtime/character/sheetProjection'
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
  authorityScope?: import('../campaigns/authority').CampaignInternalScope
) {
  const facts = await loadCharacterSheetFacts(
    ctx,
    userId,
    lookupId,
    campaignId,
    sourceContext,
    catalogScope,
    authorityScope
  )
  if (!facts) return null
  return projectCharacterSheetFacts(facts)
}

/** Projects facts already loaded in the current mutation; never retains them across transactions. */
export function projectCharacterSheetFacts(
  facts: NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts>>>
) {
  const { sheet, ruleProjection } = projectCharacterSheetBundle({
    character: facts.prepared.character,
    resolution: facts.prepared.resolution,
    streamVersion: facts.active.play.streamVersion,
    hasBuilderDraft: facts.draft !== null,
    adjustments: facts.adjustments,
    additionalConditions: getVisibleCampaignConditions(facts.campaignContext),
    additionalCurrencyOptions: facts.campaignContext.currencyOptions,
    creaturesById: facts.prepared.context.creaturesById,
    vehiclesById: facts.prepared.context.vehiclesById,
    spellCustomizations: facts.sheetState.spellCustomizations,
    ruleEvaluation: facts.ruleEvaluation,
    activeEffects: facts.activeEffects
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
    ruleEvaluation: facts.ruleEvaluation,
    ruleProjection,
    resolution: facts.prepared.resolution,
    contentMaturity: facts.prepared.context.sourceAccess.campaign?.contentMaturity ?? null,
    sheet: characterSheetResponseDtoSchema.parse({
      ...sheet,
      meta: { ...sheet.meta, partyVisibility: facts.sheetState.partyVisibility },
      publicId: facts.route.publicId
    })
  }
}
